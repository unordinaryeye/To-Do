import { makePolicy, withPolicy, alignFirstPolicy, currentPolicy, scheduledHabits, lastActivePolicy } from "../domain/schedule.js";
import { addDays } from "../utils/date.js";
import { compareKeys } from "../utils/date.js";
import { quadrantRank } from "../domain/todo.js";
import { newId } from "../utils/id.js";

// ── 액션 타입 ──
export const A = {
  CHECK_TOGGLE: "check/toggle",
  HABIT_UPSERT: "habit/upsert",
  HABIT_END: "habit/end",
  HABIT_RESUME: "habit/resume",
  HABIT_PAUSE: "habit/pause",
  HABIT_COPY: "habit/copy",
  HABIT_REORDER: "habit/reorder",
  HABIT_DELETE: "habit/delete",
  HABIT_MOVE: "habit/move",
  TODO_UPSERT: "todo/upsert",
  TODO_PRIORITY: "todo/priority",
  TODO_TOGGLE: "todo/toggle",
  TODO_DELETE: "todo/delete",
  TODO_MOVE: "todo/move",
  TAG_UPSERT: "tag/upsert",
  TAG_DELETE: "tag/delete",
  SETTINGS_SET: "settings/set",
  DATA_REPLACE: "data/replace",
  DATA_APPLY_REMOTE: "data/applyRemote",
  UI_SET: "ui/set",
};

const without = (obj, key) => {
  const { [key]: _removed, ...rest } = obj;
  return rest;
};

const maxOrder = (items) => items.reduce((max, item) => Math.max(max, item.order), -1);

/** 정렬된 목록에서 id의 이웃과 order를 맞바꾼다. 이웃이 없으면 그대로. */
function swapWithNeighbor(map, list, id, dir) {
  const index = list.findIndex((item) => item.id === id);
  const target = list[index];
  const neighbor = list[index + dir];
  if (!target || !neighbor) return map;
  return { ...map, [id]: { ...target, order: neighbor.order }, [neighbor.id]: { ...neighbor, order: target.order } };
}

function toggleCheck(checks, { date, habitId }) {
  const day = checks[date] || {};
  const nextDay = day[habitId] ? without(day, habitId) : { ...day, [habitId]: 1 };
  if (Object.keys(nextDay).length === 0) return without(checks, date);
  return { ...checks, [date]: nextDay };
}

/**
 * 습관 생성/수정. 반복·시간은 정책으로 저장된다.
 * 새 습관: startDate부터 적용되는 정책 1개. 기존 습관: 오늘(또는 미래 startDate)부터 새 정책.
 * 시작일을 앞당기면 첫 정책도 같이 앞당겨 공백이 생기지 않게 한다.
 */
function upsertHabit(habits, action) {
  const { id, name, emoji, startDate, endDate, repeatDays, trigger, today, goalTagIds } = action;
  const existing = id ? habits[id] : null;
  const habitId = existing ? id : newId("h");
  const effectiveFrom = existing ? (compareKeys(startDate, today) > 0 ? startDate : today) : startDate;
  const base = existing ? currentPolicy(existing, today) : null;
  const policy = makePolicy(effectiveFrom, {
    repeat: { days: [...repeatDays].sort((a, b) => a - b) },
    trigger: trigger?.type ? { type: trigger.type, value: trigger.value } : null,
    goalTagIds: goalTagIds ?? base?.goalTagIds ?? [],
    targetCount: base?.targetCount ?? 1,
  });
  const habit = {
    order: maxOrder(Object.values(habits)) + 1,
    deletedAt: null, showInTodo: false, legacyCategory: null,
    reminder: null, levels: null, mandalaRef: null,
    ...(existing || {}),
    id: habitId, name, emoji, startDate, endDate: endDate || null,
    policies: alignFirstPolicy(withPolicy(existing?.policies || [], policy), startDate),
  };
  return { ...habits, [habitId]: habit };
}

/** 쉬어가기: from부터 paused, until이 있으면 다음 날부터 다시 active. 설정은 마지막 활성 정책을 복사한다. */
function pauseHabit(habit, { from, until }) {
  const base = lastActivePolicy(habit, from) || habit.policies[habit.policies.length - 1];
  let policies = withPolicy(habit.policies, { ...base, effectiveFrom: from, status: "paused" });
  if (until) policies = withPolicy(policies, { ...base, effectiveFrom: addDays(until, 1), status: "active" });
  return { ...habit, policies };
}

/** 다시 시작: 종료일을 지우고, 쉬는 중이면 오늘부터 active 정책을 넣는다. */
function resumeHabit(habit, today) {
  const current = currentPolicy(habit, today);
  if (current && current.status === "active") return { ...habit, endDate: null };
  const base = lastActivePolicy(habit, today) || current || habit.policies[habit.policies.length - 1];
  return { ...habit, endDate: null, policies: withPolicy(habit.policies, { ...base, effectiveFrom: today, status: "active" }) };
}

function copyHabit(habits, habit, today) {
  const base = lastActivePolicy(habit, today) || habit.policies[habit.policies.length - 1];
  const id = newId("h");
  return {
    ...habits,
    [id]: {
      ...habit, id, name: `${habit.name} (복사)`, order: maxOrder(Object.values(habits)) + 1,
      startDate: today, endDate: null, deletedAt: null,
      policies: [{ ...base, effectiveFrom: today, status: "active" }],
    },
  };
}

function reorderHabits(habits, orderedIds) {
  const next = { ...habits };
  orderedIds.forEach((id, index) => { if (next[id]) next[id] = { ...next[id], order: index }; });
  return next;
}

function habitsReducer(habits, action) {
  const habit = habits[action.id];
  switch (action.type) {
    case A.HABIT_UPSERT: return upsertHabit(habits, action);
    case A.HABIT_END: return habit ? { ...habits, [action.id]: { ...habit, endDate: action.date } } : habits;
    case A.HABIT_RESUME: return habit ? { ...habits, [action.id]: resumeHabit(habit, action.today) } : habits;
    case A.HABIT_PAUSE: return habit ? { ...habits, [action.id]: pauseHabit(habit, action) } : habits;
    case A.HABIT_COPY: return habit ? copyHabit(habits, habit, action.today) : habits;
    case A.HABIT_REORDER: return reorderHabits(habits, action.orderedIds);
    case A.HABIT_DELETE: return habit ? without(habits, action.id) : habits;
    case A.HABIT_MOVE: {
      // 화면에 보이는 목록(선택일 예정 습관) 안에서 이웃과 바꾼다. date가 없으면 전체 목록.
      const list = action.date
        ? scheduledHabits(habits, action.date)
        : Object.values(habits).filter((h) => !h.deletedAt).sort((a, b) => a.order - b.order);
      return swapWithNeighbor(habits, list, action.id, action.dir);
    }
    default: return habits;
  }
}

const todosOfDate = (todos, date) => Object.values(todos).filter((t) => t.date === date);

/** 시간 없는 항목만 수동 순서를 가진다. 같은 사분면 안에서만 순서를 바꾼다. */
export const untimedPeers = (todos, todo) => todosOfDate(todos, todo.date)
  .filter((t) => !t.time && quadrantRank(t) === quadrantRank(todo))
  .sort((a, b) => a.order - b.order);

function upsertTodo(todos, { id, title, date, time, priority }) {
  const existing = id ? todos[id] : null;
  const todoId = existing ? id : newId("t");
  const movedDate = !existing || existing.date !== date;
  const order = movedDate ? maxOrder(todosOfDate(todos, date)) + 1 : existing.order;
  const classification = priority === undefined ? {} : priorityFields(priority);
  return {
    ...todos,
    [todoId]: {
      urgent: false, important: false, classified: false, done: false, completedAt: null, goalTagIds: [],
      ...(existing || {}),
      id: todoId, title, date, time: time || null, order,
      ...classification,
    },
  };
}

/** priority: null(미분류) 또는 { urgent, important } */
function priorityFields(priority) {
  if (!priority) return { urgent: false, important: false, classified: false };
  return { urgent: !!priority.urgent, important: !!priority.important, classified: true };
}

function todosReducer(todos, action) {
  const todo = todos[action.id];
  switch (action.type) {
    case A.TODO_UPSERT: return upsertTodo(todos, action);
    case A.TODO_TOGGLE: {
      if (!todo) return todos;
      const done = !todo.done;
      return { ...todos, [action.id]: { ...todo, done, completedAt: done ? new Date().toISOString() : null } };
    }
    case A.TODO_PRIORITY: return todo ? { ...todos, [action.id]: { ...todo, ...priorityFields(action.priority) } } : todos;
    case A.TODO_DELETE: return todo ? without(todos, action.id) : todos;
    case A.TODO_MOVE: {
      if (!todo || todo.time) return todos;
      return swapWithNeighbor(todos, untimedPeers(todos, todo), action.id, action.dir);
    }
    default: return todos;
  }
}

function tagsReducer(goalTags, action) {
  switch (action.type) {
    case A.TAG_UPSERT: {
      const id = action.id || newId("g");
      const existing = goalTags[id] || { id, archived: false, mandala: null };
      return { ...goalTags, [id]: { ...existing, name: action.name, emoji: action.emoji, color: action.color } };
    }
    case A.TAG_DELETE: {
      const tag = goalTags[action.id];
      return tag ? { ...goalTags, [action.id]: { ...tag, archived: true } } : goalTags;
    }
    default: return goalTags;
  }
}

function dataReducer(data, action) {
  switch (action.type) {
    case A.TAG_UPSERT:
    case A.TAG_DELETE: return { ...data, goalTags: tagsReducer(data.goalTags, action) };
    case A.DATA_REPLACE: return action.data;
    case A.DATA_APPLY_REMOTE: return { ...data, ...action.patch };
    case A.CHECK_TOGGLE: return { ...data, checks: toggleCheck(data.checks, action) };
    case A.SETTINGS_SET: return { ...data, settings: { ...data.settings, ...action.patch } };
    default: {
      const habits = habitsReducer(data.habits, action);
      const todos = todosReducer(data.todos, action);
      if (habits === data.habits && todos === data.todos) return data;
      return { ...data, habits, todos };
    }
  }
}

export function rootReducer(state, action) {
  if (action.type === A.UI_SET) return { ...state, ui: { ...state.ui, ...action.patch } };
  const data = dataReducer(state.data, action);
  return data === state.data ? state : { ...state, data };
}

export function initialUi({ today, syncCode, firebaseReady, route = "home" }) {
  return {
    route,               // home | stats | goals | settings
    homeTab: "habits",   // habits | todos
    selectedDate: today,
    statsMonth: today.slice(0, 7),
    statsTab: "month",   // month | week | green
    statsDate: today,    // 주간 통계 기준일
    filterTagId: null,
    page: null,          // { type: 'habitForm'|'todoForm', values } 전체 화면
    sheet: null,         // { type, ... } 바텀시트
    syncCode,
    syncConnected: false,
    firebaseReady,
  };
}

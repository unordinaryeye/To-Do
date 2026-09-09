import { makePolicy, withPolicy, currentPolicy } from "../domain/schedule.js";
import { compareKeys } from "../utils/date.js";
import { newId } from "../utils/id.js";

// ── 액션 타입 ──
export const A = {
  CHECK_TOGGLE: "check/toggle",
  HABIT_UPSERT: "habit/upsert",
  HABIT_RENAME: "habit/rename",
  HABIT_DELETE: "habit/delete",
  HABIT_MOVE: "habit/move",
  TODO_UPSERT: "todo/upsert",
  TODO_TOGGLE: "todo/toggle",
  TODO_DELETE: "todo/delete",
  TODO_MOVE: "todo/move",
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

function toggleCheck(checks, { date, habitId }) {
  const day = checks[date] || {};
  const nextDay = day[habitId] ? without(day, habitId) : { ...day, [habitId]: 1 };
  if (Object.keys(nextDay).length === 0) return without(checks, date);
  return { ...checks, [date]: nextDay };
}

/**
 * 습관 생성/수정. 반복·시간은 정책으로 저장된다.
 * 새 습관: startDate부터 적용되는 정책 1개. 기존 습관: 오늘(또는 미래 startDate)부터 새 정책.
 */
function upsertHabit(habits, action) {
  const { id, name, emoji, startDate, endDate, repeatDays, trigger, today } = action;
  const existing = id ? habits[id] : null;
  const habitId = existing ? id : newId("h");
  const effectiveFrom = existing ? (compareKeys(startDate, today) > 0 ? startDate : today) : startDate;
  const base = existing ? currentPolicy(existing, today) : null;
  const policy = makePolicy(effectiveFrom, {
    repeat: { days: [...repeatDays].sort((a, b) => a - b) },
    trigger: trigger?.type ? { type: trigger.type, value: trigger.value } : null,
    goalTagIds: base?.goalTagIds ?? [],
    targetCount: base?.targetCount ?? 1,
  });
  const habit = {
    order: maxOrder(Object.values(habits)) + 1,
    deletedAt: null, showInTodo: false, legacyCategory: null,
    reminder: null, levels: null, mandalaRef: null,
    ...(existing || {}),
    id: habitId, name, emoji, startDate, endDate: endDate || null,
    policies: withPolicy(existing?.policies || [], policy),
  };
  return { ...habits, [habitId]: habit };
}

/** 전체 목록(표시 순서) 안에서 이웃과 order를 바꾼다. */
function moveHabit(habits, { id, dir }) {
  const target = habits[id];
  if (!target) return habits;
  const list = Object.values(habits).filter((h) => !h.deletedAt).sort((a, b) => a.order - b.order);
  const index = list.findIndex((h) => h.id === id);
  const neighbor = list[index + dir];
  if (!neighbor) return habits;
  return {
    ...habits,
    [id]: { ...target, order: neighbor.order },
    [neighbor.id]: { ...neighbor, order: target.order },
  };
}

function habitsReducer(habits, action) {
  switch (action.type) {
    case A.HABIT_UPSERT: return upsertHabit(habits, action);
    case A.HABIT_RENAME: {
      const habit = habits[action.id];
      if (!habit || habit.name === action.name) return habits;
      return { ...habits, [action.id]: { ...habit, name: action.name } };
    }
    case A.HABIT_DELETE: return habits[action.id] ? without(habits, action.id) : habits;
    case A.HABIT_MOVE: return moveHabit(habits, action);
    default: return habits;
  }
}

function todosOfDate(todos, date) {
  return Object.values(todos).filter((t) => t.date === date).sort((a, b) => a.order - b.order);
}

function upsertTodo(todos, { id, title, date, time }) {
  const existing = id ? todos[id] : null;
  const todoId = existing ? id : newId("t");
  const movedDate = !existing || existing.date !== date;
  const order = movedDate ? maxOrder(todosOfDate(todos, date)) + 1 : existing.order;
  return {
    ...todos,
    [todoId]: {
      urgent: false, important: false, done: false, completedAt: null, goalTagIds: [],
      ...(existing || {}),
      id: todoId, title, date, time: time || null, order,
    },
  };
}

function todosReducer(todos, action) {
  switch (action.type) {
    case A.TODO_UPSERT: return upsertTodo(todos, action);
    case A.TODO_TOGGLE: {
      const todo = todos[action.id];
      if (!todo) return todos;
      const done = !todo.done;
      return { ...todos, [action.id]: { ...todo, done, completedAt: done ? new Date().toISOString() : null } };
    }
    case A.TODO_DELETE: return todos[action.id] ? without(todos, action.id) : todos;
    case A.TODO_MOVE: {
      const todo = todos[action.id];
      if (!todo) return todos;
      const list = todosOfDate(todos, todo.date);
      const index = list.findIndex((t) => t.id === action.id);
      const neighbor = list[index + action.dir];
      if (!neighbor) return todos;
      return {
        ...todos,
        [todo.id]: { ...todo, order: neighbor.order },
        [neighbor.id]: { ...neighbor, order: todo.order },
      };
    }
    default: return todos;
  }
}

function dataReducer(data, action) {
  switch (action.type) {
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
    filterTagId: null,
    page: null,          // { type: 'habitForm', id, values } 전체 화면
    sheet: null,         // { type, ... } 바텀시트
    syncCode,
    syncConnected: false,
    firebaseReady,
  };
}

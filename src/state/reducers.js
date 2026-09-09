import { CATEGORIES } from "../config.js";
import { makePolicy } from "../domain/schedule.js";
import { newId } from "../utils/id.js";

// ── 도메인 액션 타입 ──
export const A = {
  CHECK_TOGGLE: "check/toggle",
  HABIT_ADD: "habit/add",
  HABIT_RENAME: "habit/rename",
  HABIT_DELETE: "habit/delete",
  HABIT_MOVE: "habit/move",
  TODO_ADD: "todo/add",
  TODO_TOGGLE: "todo/toggle",
  TODO_RENAME: "todo/rename",
  TODO_DELETE: "todo/delete",
  TODO_MOVE: "todo/move",
  DATA_REPLACE: "data/replace",
  DATA_APPLY_REMOTE: "data/applyRemote",
  UI_SET: "ui/set",
};

const without = (obj, key) => {
  const { [key]: _removed, ...rest } = obj;
  return rest;
};

function toggleCheck(checks, { date, habitId }) {
  const day = checks[date] || {};
  const nextDay = day[habitId] ? without(day, habitId) : { ...day, [habitId]: 1 };
  if (Object.keys(nextDay).length === 0) return without(checks, date);
  return { ...checks, [date]: nextDay };
}

function addHabit(habits, { name, emoji, category, today }) {
  const order = Object.values(habits).reduce((max, h) => Math.max(max, h.order), -1) + 1;
  const id = newId("h");
  const habit = {
    id, name, emoji, order,
    startDate: today, endDate: null, deletedAt: null, showInTodo: false,
    legacyCategory: category ?? null,
    policies: [makePolicy(today, { goalTagIds: category ? [category] : [] })],
    reminder: null, levels: null, mandalaRef: null,
  };
  return { ...habits, [id]: habit };
}

/** 같은 카테고리 안에서 order를 이웃과 바꾼다. */
function moveHabit(habits, { id, dir }) {
  const target = habits[id];
  if (!target) return habits;
  const siblings = Object.values(habits)
    .filter((h) => !h.deletedAt && h.legacyCategory === target.legacyCategory)
    .sort((a, b) => a.order - b.order);
  const index = siblings.findIndex((h) => h.id === id);
  const neighbor = siblings[index + dir];
  if (!neighbor) return habits;
  return {
    ...habits,
    [id]: { ...target, order: neighbor.order },
    [neighbor.id]: { ...neighbor, order: target.order },
  };
}

function habitsReducer(habits, action) {
  switch (action.type) {
    case A.HABIT_ADD: return addHabit(habits, action);
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

function todosReducer(todos, action) {
  switch (action.type) {
    case A.TODO_ADD: {
      const order = todosOfDate(todos, action.date).reduce((max, t) => Math.max(max, t.order), -1) + 1;
      const id = newId("t");
      return {
        ...todos,
        [id]: {
          id, title: action.title, date: action.date, time: null, urgent: false, important: false,
          done: false, completedAt: null, order, goalTagIds: [],
        },
      };
    }
    case A.TODO_TOGGLE: {
      const todo = todos[action.id];
      if (!todo) return todos;
      const done = !todo.done;
      return { ...todos, [action.id]: { ...todo, done, completedAt: done ? new Date().toISOString() : null } };
    }
    case A.TODO_RENAME: {
      const todo = todos[action.id];
      if (!todo || todo.title === action.title) return todos;
      return { ...todos, [action.id]: { ...todo, title: action.title } };
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

export function initialUi({ today, syncCode, firebaseReady }) {
  return {
    view: "daily",
    selectedDate: today,
    editingId: null,
    editingTodoId: null,
    showEmojiPicker: false,
    newEmoji: "✅",
    newCategory: CATEGORIES[0].id,
    showSettings: false,
    showConfirm: false,
    syncCode,
    syncConnected: false,
    firebaseReady,
  };
}

/**
 * 로컬 데이터 ↔ Firestore 문서 변환. IO 없이 순수 함수만 둔다.
 *
 * 문서 구조 (workspaces/{code}/data/*):
 *   habits            { habits, goalTags, routines, settings }
 *   todos-YYYY-MM     { todos: { id: todo } }
 *   checks-YYYY-MM    { checks: { date: { habitId: count } } }
 */
import { monthKey } from "../utils/date.js";

export const HABITS_DOC = "habits";
const ENTITY_SLICES = ["habits", "goalTags", "routines", "mandalarts"];

/** 키 순서에 상관없이 같은 내용이면 같은 문자열. */
export function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

export const same = (a, b) => stableStringify(a) === stableStringify(b);

export function monthsOf(data) {
  const months = new Set();
  Object.values(data.todos).forEach((t) => months.add(monthKey(t.date)));
  Object.keys(data.checks).forEach((date) => months.add(monthKey(date)));
  return months;
}

export function todosOfMonth(data, month) {
  return Object.fromEntries(Object.entries(data.todos).filter(([, t]) => monthKey(t.date) === month));
}

export function checksOfMonth(data, month) {
  return Object.fromEntries(Object.entries(data.checks).filter(([date]) => monthKey(date) === month));
}

export function habitsDocOf(data) {
  return { habits: data.habits, goalTags: data.goalTags, routines: data.routines, mandalarts: data.mandalarts || {}, settings: data.settings };
}

/** 로컬 데이터를 문서 id → 내용 맵으로. */
export function snapshotOf(data) {
  const docs = { [HABITS_DOC]: habitsDocOf(data) };
  for (const month of monthsOf(data)) {
    docs[`todos-${month}`] = { todos: todosOfMonth(data, month) };
    docs[`checks-${month}`] = { checks: checksOfMonth(data, month) };
  }
  return docs;
}

/** 원격에는 있는데 로컬에 없는 월 문서는 "빈 문서"로 취급해 삭제가 전파되게 한다. */
export function emptyDocFor(id) {
  if (id.startsWith("todos-")) return { todos: {} };
  if (id.startsWith("checks-")) return { checks: {} };
  return null;
}

/** 두 맵을 비교해 merge 페이로드를 만든다. 사라진 키는 deleteValue. depth=2면 한 단계 더 들어간다. */
export function diffMap(prev = {}, next = {}, deleteValue, depth = 1) {
  const out = {};
  for (const [key, value] of Object.entries(next)) {
    if (depth > 1 && typeof value === "object" && value !== null) {
      const nested = diffMap(prev[key] || {}, value, deleteValue, depth - 1);
      if (Object.keys(nested).length) out[key] = nested;
    } else if (!same(prev[key], value)) {
      out[key] = value;
    }
  }
  for (const key of Object.keys(prev)) {
    if (!(key in next)) out[key] = deleteValue;
  }
  return out;
}

/** 문서 하나에 대한 merge 페이로드. 변화가 없으면 null. prev가 없으면 통째로. */
export function payloadFor(id, prev, next, deleteValue) {
  if (!prev) return next;
  if (same(prev, next)) return null;
  if (id === HABITS_DOC) {
    const payload = {};
    for (const slice of ENTITY_SLICES) {
      const diff = diffMap(prev[slice], next[slice], deleteValue);
      if (Object.keys(diff).length) payload[slice] = diff;
    }
    if (!same(prev.settings, next.settings)) payload.settings = next.settings;
    return Object.keys(payload).length ? payload : null;
  }
  if (id.startsWith("todos-")) return { todos: diffMap(prev.todos, next.todos, deleteValue) };
  if (id.startsWith("checks-")) return { checks: diffMap(prev.checks, next.checks, deleteValue, 2) };
  return null;
}

/** 원격 문서 하나를 로컬 data에 반영했을 때 바뀌는 슬라이스만 담은 patch. */
export function patchFromDoc(id, body, data) {
  if (id === HABITS_DOC) {
    const patch = {};
    for (const slice of [...ENTITY_SLICES, "settings"]) {
      if (body[slice] && !same(body[slice], data[slice])) patch[slice] = body[slice];
    }
    return patch;
  }
  if (id.startsWith("todos-")) {
    const month = id.slice(6);
    const remote = body.todos || {};
    if (same(remote, todosOfMonth(data, month))) return {};
    const kept = Object.fromEntries(Object.entries(data.todos).filter(([, t]) => monthKey(t.date) !== month));
    return { todos: { ...kept, ...remote } };
  }
  if (id.startsWith("checks-")) {
    const month = id.slice(7);
    const remote = body.checks || {};
    if (same(remote, checksOfMonth(data, month))) return {};
    const kept = Object.fromEntries(Object.entries(data.checks).filter(([date]) => monthKey(date) !== month));
    return { checks: { ...kept, ...remote } };
  }
  return {};
}

/** 문서 목록(id, body)에서 전체 데이터를 조립한다. */
export function assembleData(docs, base) {
  const data = { ...base, todos: { ...base.todos }, checks: { ...base.checks } };
  for (const { id, body } of docs) {
    if (id === HABITS_DOC) Object.assign(data, body);
    else if (body.todos) Object.assign(data.todos, body.todos);
    else if (body.checks) Object.assign(data.checks, body.checks);
  }
  return data;
}

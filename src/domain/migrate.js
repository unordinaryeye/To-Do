import { SCHEMA_VERSION, CATEGORIES, DEFAULT_ROUTINES, ALL_WEEKDAYS } from "../config.js";
import { makePolicy } from "./schedule.js";
import { compareKeys } from "../utils/date.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function emptyData() {
  return {
    settings: { weekStart: 1, todoView: "list", clock24: true },
    habits: {},
    checks: {},
    todos: {},
    goalTags: {},
    routines: {},
  };
}

export function defaultData(todayKey) {
  return migrateLegacy({ routines: DEFAULT_ROUTINES, checks: {}, todos: {} }, todayKey).data;
}

function categoryTags() {
  return Object.fromEntries(CATEGORIES.map((c) => [
    c.id,
    { id: c.id, name: c.name, emoji: c.emoji, color: c.color, archived: false, mandala: null },
  ]));
}

function earliestCheckDate(checks) {
  return Object.keys(checks).filter((k) => DATE_RE.test(k)).sort(compareKeys)[0] || null;
}

function legacyHabit(routine, index, startDate) {
  return {
    id: String(routine.id),
    name: String(routine.text ?? ""),
    emoji: String(routine.emoji ?? "✅"),
    order: index,
    startDate,
    endDate: null,
    deletedAt: null,
    showInTodo: false,
    legacyCategory: routine.category ?? null,
    policies: [makePolicy(startDate, {
      repeat: { days: [...ALL_WEEKDAYS] },
      goalTagIds: routine.category ? [routine.category] : [],
    })],
    reminder: null,
    levels: null,
    mandalaRef: null,
  };
}

function legacyChecks(checks, warnings) {
  const out = {};
  for (const [date, byHabit] of Object.entries(checks || {})) {
    if (!DATE_RE.test(date) || typeof byHabit !== "object" || byHabit === null) {
      warnings.push(`checks: 잘못된 날짜 키 무시 (${date})`);
      continue;
    }
    const day = {};
    for (const [habitId, value] of Object.entries(byHabit)) {
      const count = typeof value === "number" ? value : value ? 1 : 0;
      if (count > 0) day[habitId] = count;
    }
    if (Object.keys(day).length) out[date] = day;
  }
  return out;
}

function legacyTodos(todos, warnings) {
  const out = {};
  for (const [date, list] of Object.entries(todos || {})) {
    if (!DATE_RE.test(date) || !Array.isArray(list)) {
      warnings.push(`todos: 잘못된 항목 무시 (${date})`);
      continue;
    }
    list.forEach((item, index) => {
      let id = String(item.id ?? `${date}_${index}`);
      if (out[id]) id = `${id}_${date}`;
      out[id] = {
        id,
        title: String(item.text ?? ""),
        date,
        time: null,
        urgent: false,
        important: false,
        done: !!item.done,
        completedAt: null,
        order: index,
        goalTagIds: [],
      };
    });
  }
  return out;
}

/** v2(routines/checks/todos) → v3. 입력을 변경하지 않는다. */
export function migrateLegacy(source, todayKey) {
  const warnings = [];
  const routines = Array.isArray(source.routines) ? source.routines : [];
  const checks = legacyChecks(source.checks, warnings);
  const startDate = earliestCheckDate(checks) || todayKey;
  const habits = {};
  routines.forEach((routine, index) => {
    if (!routine || routine.id == null) {
      warnings.push(`routines: id 없는 항목 무시 (index ${index})`);
      return;
    }
    const habit = legacyHabit(routine, index, startDate);
    if (habits[habit.id]) warnings.push(`routines: 중복 id 덮어씀 (${habit.id})`);
    habits[habit.id] = habit;
  });
  const data = {
    ...emptyData(),
    habits,
    checks,
    todos: legacyTodos(source.todos, warnings),
    goalTags: categoryTags(),
  };
  return { data, warnings };
}

export function isV3Envelope(value) {
  return !!value && typeof value === "object" && value.schemaVersion === SCHEMA_VERSION && !!value.data;
}

export function isLegacyShape(value) {
  return !!value && typeof value === "object" && Array.isArray(value.routines) && typeof value.checks === "object";
}

/** v3 데이터에 빠진 슬라이스를 채운다. 알 수 없는 슬라이스는 버리지 않고 보존한다. */
export function normalizeV3(data) {
  const base = emptyData();
  return {
    ...base,
    ...data,
    settings: { ...base.settings, ...(data.settings || {}) },
    habits: data.habits || {},
    checks: data.checks || {},
    todos: data.todos || {},
    goalTags: data.goalTags || {},
    routines: data.routines || {},
  };
}

/**
 * 어떤 형태의 입력이든 v3 데이터로 만든다.
 * 반환: { data, warnings, source: 'v3' | 'legacy' | 'empty' | 'future' }
 */
export function migrateAny(value, todayKey) {
  if (isV3Envelope(value)) return { data: normalizeV3(value.data), warnings: [], source: "v3" };
  if (value && typeof value === "object" && typeof value.schemaVersion === "number" && value.schemaVersion > SCHEMA_VERSION) {
    return { data: null, warnings: ["앱보다 새로운 데이터 형식입니다. 앱을 업데이트해 주세요."], source: "future" };
  }
  if (isLegacyShape(value)) {
    const result = migrateLegacy(value, todayKey);
    return { ...result, source: "legacy" };
  }
  return { data: null, warnings: ["알 수 없는 데이터 형식"], source: "empty" };
}

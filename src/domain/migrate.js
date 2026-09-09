import { SCHEMA_VERSION, CATEGORIES, DEFAULT_ROUTINES, ALL_WEEKDAYS, LEGACY_START_DATE } from "../config.js";
import { makePolicy } from "./schedule.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function emptyData() {
  return {
    settings: { weekStart: 1, todoView: "list", clock24: true },
    habits: {},
    checks: {},
    todos: {},
    goalTags: {},
    routines: {},
    mandalarts: {},
  };
}

/** 첫 설치 샘플. 예전 앱과 같이 과거 날짜에서도 보이도록 레거시 시작일을 쓴다. */
export function defaultData(todayKey) {
  return migrateLegacy({ routines: DEFAULT_ROUTINES, checks: {}, todos: {} }, todayKey).data;
}

function categoryTags() {
  return Object.fromEntries(CATEGORIES.map((c) => [
    c.id,
    { id: c.id, name: c.name, emoji: c.emoji, color: c.color, archived: false, mandala: null },
  ]));
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

/**
 * v2(routines/checks/todos) → v3. 입력을 변경하지 않는다.
 * v2에는 생성일이 없으므로 예전 앱과 같이 모든 과거 날짜에 존재했던 것으로 본다(LEGACY_START_DATE).
 * 기본 샘플처럼 "오늘 만든" 데이터는 startDate를 넘겨 오늘부터 시작한다.
 */
export function migrateLegacy(source, todayKey, { startDate = LEGACY_START_DATE } = {}) {
  const warnings = [];
  const routines = Array.isArray(source.routines) ? source.routines : [];
  const checks = legacyChecks(source.checks, warnings);
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

const isObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/** 습관 하나가 렌더/계산에 필요한 최소 형태를 갖추게 한다. 정책이 없으면 시작일부터 매일. */
function sanitizeHabit(id, habit, index) {
  const base = isObject(habit) ? habit : {};
  const startDate = DATE_RE.test(base.startDate) ? base.startDate : LEGACY_START_DATE;
  const policies = Array.isArray(base.policies) && base.policies.length
    ? base.policies.filter((p) => isObject(p) && DATE_RE.test(p.effectiveFrom) && isObject(p.repeat) && Array.isArray(p.repeat.days))
    : [];
  return {
    ...legacyHabit({ id, text: base.name, emoji: base.emoji, category: base.legacyCategory }, index, startDate),
    ...base,
    id,
    name: typeof base.name === "string" ? base.name : "",
    order: typeof base.order === "number" ? base.order : index,
    policies: policies.length ? policies : [makePolicy(startDate, { repeat: { days: [...ALL_WEEKDAYS] } })],
  };
}

/** v3 데이터에 빠진 슬라이스를 채우고 엔터티 형태를 검증한다. 알 수 없는 슬라이스는 보존한다. */
export function normalizeV3(data) {
  const base = emptyData();
  const source = isObject(data) ? data : {};
  const habits = Object.fromEntries(
    Object.entries(isObject(source.habits) ? source.habits : {}).map(([id, habit], i) => [id, sanitizeHabit(id, habit, i)]),
  );
  return {
    ...base,
    ...source,
    settings: { ...base.settings, ...(isObject(source.settings) ? source.settings : {}) },
    habits,
    checks: isObject(source.checks) ? source.checks : {},
    todos: isObject(source.todos) ? source.todos : {},
    goalTags: isObject(source.goalTags) ? source.goalTags : {},
    routines: isObject(source.routines) ? source.routines : {},
    mandalarts: isObject(source.mandalarts) ? source.mandalarts : {},
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

import { scheduledHabits, currentPolicy, policyAt } from "../domain/schedule.js";
import { compareKeys } from "../utils/date.js";
import { compareTodos, quadrantOf, quadrantRank, QUADRANTS } from "../domain/todo.js";

export function activeHabits(data) {
  return Object.values(data.habits).filter((h) => !h.deletedAt).sort((a, b) => a.order - b.order);
}

/** 종료일이 지나 더 이상 예정되지 않는 습관(복구 경로용). */
export function endedHabits(data, todayKey) {
  return activeHabits(data).filter((h) => h.endDate && compareKeys(h.endDate, todayKey) < 0);
}

/** 오늘 쉬는 중인 습관 */
export function pausedHabits(data, todayKey) {
  return activeHabits(data).filter((h) => !h.endDate && currentPolicy(h, todayKey)?.status === "paused");
}

const triggerTime = (habit, dateKey) => {
  const trigger = policyAt(habit, dateKey)?.trigger;
  return trigger?.type === "time" ? trigger.value : null;
};

/** 시간순 자동 정렬: 시간 있는 습관은 시간순으로 먼저, 나머지는 수동 순서. 설정으로 끌 수 있다. */
export function sortHabitsForDisplay(list, data, dateKey) {
  if (data.settings.sortByTime === false) return list;
  return [...list].sort((a, b) => {
    const ta = triggerTime(a, dateKey);
    const tb = triggerTime(b, dateKey);
    if (ta && tb) return ta < tb ? -1 : ta > tb ? 1 : a.order - b.order;
    if (ta) return -1;
    if (tb) return 1;
    return a.order - b.order;
  });
}

/** 선택일에 예정된 습관(표시 순서). 태그 필터가 있으면 그날 정책의 태그로 거른다. */
export function habitsForDate(data, dateKey, filterTagId = null) {
  const list = sortHabitsForDisplay(scheduledHabits(data.habits, dateKey), data, dateKey);
  if (!filterTagId) return list;
  return list.filter((habit) => (policyAt(habit, dateKey)?.goalTagIds || []).includes(filterTagId));
}

/** 홈 필터 칩에 보여줄 태그: 활성 습관이 하나라도 쓰는 태그만. */
export function tagsInUse(data, todayKey) {
  const used = new Set();
  for (const habit of activeHabits(data)) {
    (currentPolicy(habit, todayKey)?.goalTagIds || []).forEach((id) => used.add(id));
  }
  return Object.values(data.goalTags).filter((tag) => used.has(tag.id) && !tag.archived);
}

/** 시간 있는 항목 시간순 → 시간 없는 항목은 사분면 순 → 수동 순서. */
export function todosForDate(data, dateKey) {
  return Object.values(data.todos).filter((t) => t.date === dateKey).sort(compareTodos);
}

export function undoneTodos(data, dateKey) {
  return Object.values(data.todos).filter((t) => t.date === dateKey && !t.done);
}

/** 선택일 이전의 모든 미완료 투두 */
export function overdueTodos(data, dateKey) {
  return Object.values(data.todos).filter((t) => t.date < dateKey && !t.done);
}

/** 투두 탭에도 표시하기로 한, 그날 예정된 습관 */
export function habitsInTodo(data, dateKey) {
  return scheduledHabits(data.habits, dateKey).filter((h) => h.showInTodo);
}

/** 투두 이동 가능 여부: 시간 없는 같은 사분면 항목 중 첫/마지막이면 해당 방향 불가. */
export function todoMoveBounds(data, todo) {
  if (todo.time) return { up: false, down: false };
  const list = todosForDate(data, todo.date).filter((t) => !t.time && quadrantRank(t) === quadrantRank(todo));
  const index = list.findIndex((t) => t.id === todo.id);
  return { up: index > 0, down: index >= 0 && index < list.length - 1 };
}

/** 매트릭스 보기: 사분면별 목록 + 미분류. 각 목록은 표시 순서를 따른다. */
export function quadrantGroups(data, dateKey) {
  const groups = Object.fromEntries(QUADRANTS.map((q) => [q.id, []]));
  groups.none = [];
  for (const todo of todosForDate(data, dateKey)) {
    const q = quadrantOf(todo);
    groups[q ? q.id : "none"].push(todo);
  }
  return groups;
}

/** 습관 이동 가능 여부: 선택일 화면 목록 기준. 시간순 정렬 중이면 시간 있는 습관은 이동 불가. */
export function habitMoveBounds(data, habitId, dateKey) {
  const habit = data.habits[habitId];
  if (data.settings.sortByTime !== false && habit && triggerTime(habit, dateKey)) return { up: false, down: false, byTime: true };
  const list = habitsForDate(data, dateKey).filter((h) => data.settings.sortByTime === false || !triggerTime(h, dateKey));
  const index = list.findIndex((h) => h.id === habitId);
  return { up: index > 0, down: index >= 0 && index < list.length - 1, byTime: false };
}

export function recordedDayCount(data) {
  return Object.keys(data.checks).length;
}

/** 폼 초기값. id가 없으면 새 습관 기본값. */
export function habitFormValues(data, id, todayKey) {
  const habit = id ? data.habits[id] : null;
  const policy = habit ? currentPolicy(habit, todayKey) : null;
  return {
    id: habit?.id ?? null,
    name: habit?.name ?? "",
    emoji: habit?.emoji ?? "✅",
    startDate: habit?.startDate ?? todayKey,
    endDate: habit?.endDate ?? "",
    originalEndDate: habit?.endDate ?? "",
    repeatDays: policy?.repeat.days ?? [1, 2, 3, 4, 5, 6, 7],
    triggerType: policy?.trigger?.type ?? "none",
    triggerTime: policy?.trigger?.type === "time" ? policy.trigger.value : "",
    triggerText: policy?.trigger?.type === "context" ? policy.trigger.value : "",
    goalTagIds: policy?.goalTagIds ?? [],
    showInTodo: !!habit?.showInTodo,
    targetCount: policy?.targetCount ?? 1,
    reminderOn: !!habit?.reminder?.enabled,
    reminderTime: habit?.reminder?.time ?? "",
  };
}

/** 그날 습관의 목표 횟수와 현재 횟수 */
export function checkProgress(data, habit, dateKey) {
  const target = Math.max(1, policyAt(habit, dateKey)?.targetCount ?? 1);
  const value = (data.checks[dateKey] || {})[habit.id];
  const count = typeof value === "number" ? value : value ? 1 : 0;
  return { count, target };
}

export function activeTags(data) {
  return Object.values(data.goalTags).filter((tag) => !tag.archived);
}

export function tagFormValues(data, id, fallbackColor) {
  const tag = id ? data.goalTags[id] : null;
  return { id: tag?.id ?? null, name: tag?.name ?? "", emoji: tag?.emoji ?? "🎯", color: tag?.color ?? fallbackColor };
}

export function todoFormValues(data, id, dateKey) {
  const todo = id ? data.todos[id] : null;
  return {
    id: todo?.id ?? null,
    title: todo?.title ?? "",
    date: todo?.date ?? dateKey,
    time: todo?.time ?? "",
    classified: !!todo?.classified,
    urgent: !!todo?.urgent,
    important: !!todo?.important,
  };
}

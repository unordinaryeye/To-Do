import { scheduledHabits, currentPolicy, policyAt } from "../domain/schedule.js";
import { compareKeys } from "../utils/date.js";

export function activeHabits(data) {
  return Object.values(data.habits).filter((h) => !h.deletedAt).sort((a, b) => a.order - b.order);
}

/** 종료일이 지나 더 이상 예정되지 않는 습관(복구 경로용). */
export function endedHabits(data, todayKey) {
  return activeHabits(data).filter((h) => h.endDate && compareKeys(h.endDate, todayKey) < 0);
}

/** 선택일에 예정된 습관. 태그 필터가 있으면 그날 정책의 태그로 거른다. */
export function habitsForDate(data, dateKey, filterTagId = null) {
  const list = scheduledHabits(data.habits, dateKey);
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

/** 시간 있는 항목 시간순 → 시간 없는 항목 수동 순서. */
export function todosForDate(data, dateKey) {
  return Object.values(data.todos)
    .filter((t) => t.date === dateKey)
    .sort((a, b) => {
      if (a.time && b.time) return a.time < b.time ? -1 : a.time > b.time ? 1 : a.order - b.order;
      if (a.time) return -1;
      if (b.time) return 1;
      return a.order - b.order;
    });
}

/** 투두 이동 가능 여부: 시간 없는 항목 중 첫/마지막이면 해당 방향 불가. */
export function todoMoveBounds(data, todo) {
  if (todo.time) return { up: false, down: false };
  const list = todosForDate(data, todo.date).filter((t) => !t.time);
  const index = list.findIndex((t) => t.id === todo.id);
  return { up: index > 0, down: index >= 0 && index < list.length - 1 };
}

/** 습관 이동 가능 여부: 선택일 화면 목록 기준. */
export function habitMoveBounds(data, habitId, dateKey) {
  const list = scheduledHabits(data.habits, dateKey);
  const index = list.findIndex((h) => h.id === habitId);
  return { up: index > 0, down: index >= 0 && index < list.length - 1 };
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
  };
}

export function todoFormValues(data, id, dateKey) {
  const todo = id ? data.todos[id] : null;
  return {
    id: todo?.id ?? null,
    title: todo?.title ?? "",
    date: todo?.date ?? dateKey,
    time: todo?.time ?? "",
  };
}

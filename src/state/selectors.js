import { CATEGORIES } from "../config.js";
import { scheduledHabits } from "../domain/schedule.js";

export function activeHabits(data) {
  return Object.values(data.habits).filter((h) => !h.deletedAt).sort((a, b) => a.order - b.order);
}

/** 현재 UI의 카테고리 그룹. 선택일에 예정된 습관만 넣는다. */
export function groupedForDate(data, dateKey) {
  const scheduled = scheduledHabits(data.habits, dateKey);
  return groupByCategory(scheduled);
}

/** 루틴 관리 화면: 삭제되지 않은 모든 습관. */
export function groupedAll(data) {
  return groupByCategory(activeHabits(data));
}

function groupByCategory(habits) {
  return CATEGORIES
    .map((c) => ({ ...c, items: habits.filter((h) => h.legacyCategory === c.id) }))
    .filter((g) => g.items.length > 0);
}

export function todosForDate(data, dateKey) {
  return Object.values(data.todos)
    .filter((t) => t.date === dateKey)
    .sort((a, b) => a.order - b.order);
}

export function recordedDayCount(data) {
  return Object.keys(data.checks).length;
}

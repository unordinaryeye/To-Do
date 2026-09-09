import { h } from "../utils/dom.js";
import { todayKey } from "../utils/date.js";
import { activeHabits } from "../state/selectors.js";
import { currentPolicy } from "../domain/schedule.js";
import { monthlyStats } from "../domain/metrics.js";
import { listItem, emptyState } from "./parts.js";

/** R1: 목표 태그 목록만. 편집과 만다라트는 R2/R3. */
export function renderGoals(state) {
  const today = todayKey();
  const { habits, checks, goalTags } = state.data;
  const stats = monthlyStats(habits, checks, today.slice(0, 7), today);
  const active = activeHabits(state.data);
  const rows = Object.values(goalTags).filter((tag) => !tag.archived).map((tag) => {
    const members = active.filter((habit) => (currentPolicy(habit, today)?.goalTagIds || []).includes(tag.id));
    const memberRows = stats.perHabit.filter((row) => members.some((m) => m.id === row.habit.id));
    const scheduled = memberRows.reduce((s, r) => s + r.scheduled, 0);
    const done = memberRows.reduce((s, r) => s + r.done, 0);
    const pct = scheduled ? Math.round((done / scheduled) * 100) : null;
    return listItem({
      icon: tag.emoji, iconBg: `${tag.color}22`, main: tag.name,
      sub: `습관 ${members.length}개 · 이번 달 ${pct == null ? "–" : pct + "%"}`,
      isStatic: true,
    });
  });
  return h("div", { class: "screen fade-in" },
    h("div", { class: "page-title" }, "목표"),
    rows.length ? rows : emptyState("🎯", "목표 태그가 없어요", "다음 업데이트에서 목표를 만들 수 있어요"),
    h("div", { class: "version" }, "목표 편집과 만다라트는 다음 단계에서 추가돼요"),
  );
}

import { h } from "../utils/dom.js";
import { todayKey } from "../utils/date.js";
import { activeHabits, activeTags } from "../state/selectors.js";
import { currentPolicy } from "../domain/schedule.js";
import { monthlyStats } from "../domain/metrics.js";
import { listItem, emptyState } from "./parts.js";

export function renderGoals(state) {
  const today = todayKey();
  const { habits, checks } = state.data;
  const stats = monthlyStats(habits, checks, today.slice(0, 7), today);
  const active = activeHabits(state.data);
  const rows = activeTags(state.data).map((tag) => {
    const members = active.filter((habit) => (currentPolicy(habit, today)?.goalTagIds || []).includes(tag.id));
    const memberRows = stats.perHabit.filter((row) => members.some((m) => m.id === row.habit.id));
    const scheduled = memberRows.reduce((s, r) => s + r.scheduled, 0);
    const done = memberRows.reduce((s, r) => s + r.done, 0);
    const pct = scheduled ? Math.round((done / scheduled) * 100) : null;
    return listItem({
      icon: tag.emoji, iconBg: `${tag.color}22`, main: tag.name,
      sub: `습관 ${members.length}개 · 이번 달 ${pct == null ? "–" : pct + "%"}`,
      right: "›",
      dataset: { action: "openTagActions", id: tag.id },
    });
  });
  return h("div", { class: "screen fade-in" },
    h("div", { class: "page-title-row" },
      h("div", { class: "page-title" }, "목표"),
      h("button", { class: "btn ghost", dataset: { action: "openTagForm" } }, "+ 추가"),
    ),
    rows.length ? rows : emptyState("🎯", "목표 태그가 없어요", "오른쪽 위 + 추가로 만들어요"),
    h("div", { class: "version" }, "만다라트는 다음 단계에서 추가돼요"),
  );
}

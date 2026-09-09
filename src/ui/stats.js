import { h } from "../utils/dom.js";
import { formatMonthKR, isoWeekday, todayKey, fromDateKey } from "../utils/date.js";
import { monthlyStats } from "../domain/metrics.js";

function dayGrid(row, days, weekStart) {
  const lead = (isoWeekday(days[0]) - weekStart + 7) % 7;
  const blanks = Array.from({ length: lead }, () => h("div", { class: "day-cell blank" }));
  const cells = days.map((day) => h("div", { class: `day-cell ${row.cells[day]}` }, String(fromDateKey(day).getDate())));
  return h("div", { class: "day-grid" }, ...blanks, ...cells);
}

function habitCard(row, days, weekStart) {
  return h("div", { class: "habit-card" },
    h("div", { class: "hc-title" }, `${row.habit.emoji} ${row.habit.name}`),
    dayGrid(row, days, weekStart),
    h("div", { class: "hc-foot" },
      h("span", null, `🕓 ${row.pct == null ? "–" : row.pct + "%"}`),
      h("span", null, `✔ ${row.done}`),
    ),
  );
}

export function renderStats(state) {
  const { statsMonth } = state.ui;
  const { habits, checks, settings } = state.data;
  const stats = monthlyStats(habits, checks, statsMonth, todayKey());
  const weekStart = settings.weekStart ?? 1;
  const isCurrent = statsMonth === todayKey().slice(0, 7);
  return h("div", { class: "screen fade-in" },
    h("div", { class: "page-title" }, "통계"),
    h("div", { class: "stats-head" },
      h("button", { class: "arrow", dataset: { action: "moveStatsMonth", n: "-1" } }, "‹"),
      h("span", null, formatMonthKR(statsMonth)),
      h("button", { class: "arrow", dataset: { action: "moveStatsMonth", n: "1" }, disabled: isCurrent, style: isCurrent ? { opacity: ".3" } : undefined }, "›"),
    ),
    h("div", { class: "card" },
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" } },
        h("span", { style: { fontWeight: "600" } }, "📊 목표 달성률"),
        h("span", { class: "big-pct" }, stats.pct == null ? "–" : `${stats.pct}%`),
      ),
      h("div", { class: "progress-track" }, h("div", { class: "progress-fill", style: { width: `${stats.pct ?? 0}%` } })),
      h("div", { style: { fontSize: "12px", color: "var(--muted)", marginTop: "8px" } }, `초록불 ${stats.greenDays}일`),
    ),
    stats.perHabit.length
      ? h("div", { class: "stat-grid", style: { marginTop: "12px" } }, stats.perHabit.map((row) => habitCard(row, stats.days, weekStart)))
      : h("div", { class: "empty-state" }, h("div", { class: "big" }, "📭"), h("p", { class: "main" }, "이 달엔 기록이 없어요")),
  );
}

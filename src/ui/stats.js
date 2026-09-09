import { h } from "../utils/dom.js";
import { formatMonthKR, isoWeekday, todayKey, fromDateKey, ISO_DAYS_KR } from "../utils/date.js";
import { monthlyStats, monthlyTodoStats } from "../domain/metrics.js";
import { renderWeekView, renderGreenView } from "./stats-views.js";

const TABS = [["month", "월간"], ["week", "주간"], ["green", "초록불"]];

function weekdayHeader(weekStart) {
  const days = Array.from({ length: 7 }, (_, i) => ((weekStart - 1 + i) % 7) + 1);
  return h("div", { class: "day-grid head" }, days.map((d) => h("div", { class: "day-cell blank" }, ISO_DAYS_KR[d])));
}

function dayGrid(row, days, weekStart) {
  const lead = (isoWeekday(days[0]) - weekStart + 7) % 7;
  const blanks = Array.from({ length: lead }, () => h("div", { class: "day-cell blank" }));
  const cells = days.map((day) => h("div", { class: `day-cell ${row.cells[day]}`, title: day }, String(fromDateKey(day).getDate())));
  return h("div", { class: "day-grid" }, ...blanks, ...cells);
}

function habitCard(row, days, weekStart) {
  return h("div", { class: "habit-card" },
    h("div", { class: "hc-title" }, `${row.habit.emoji} ${row.habit.name}`),
    weekdayHeader(weekStart),
    dayGrid(row, days, weekStart),
    h("div", { class: "hc-foot" },
      h("span", null, `🕓 ${row.pct == null ? "–" : row.pct + "%"}`),
      h("span", null, `✔ ${row.done}`),
    ),
  );
}

function summaryCard(stats, todoStats) {
  return h("div", { class: "card" },
    h("div", { class: "card-row" },
      h("span", { class: "card-title" }, "📊 목표 달성률"),
      h("span", { class: "big-pct" }, stats.pct == null ? "–" : `${stats.pct}%`),
    ),
    h("div", { class: "progress-track" }, h("div", { class: "progress-fill", style: { width: `${stats.pct ?? 0}%` } })),
    h("div", { class: "card-meta" }, `초록불 ${stats.greenDays}일 · 최장 연속 ${stats.longestStreak}일`),
    h("div", { class: "section-divider" }),
    h("div", { class: "card-row" },
      h("span", { class: "card-title" }, "📌 투두"),
      h("span", { class: "card-meta" }, todoStats.total ? `완료 ${todoStats.done} / 등록 ${todoStats.total} · ${todoStats.pct}%` : "등록된 할 일 없음"),
    ),
  );
}

function renderMonthView(state) {
  const { statsMonth } = state.ui;
  const { habits, checks, todos, settings } = state.data;
  const today = todayKey();
  const stats = monthlyStats(habits, checks, statsMonth, today);
  const todoStats = monthlyTodoStats(todos, statsMonth);
  const weekStart = settings.weekStart ?? 1;
  const isCurrent = statsMonth === today.slice(0, 7);
  return [
    h("div", { class: "stats-head" },
      h("button", { class: "arrow", dataset: { action: "moveStatsMonth", n: "-1" }, "aria-label": "지난달" }, "‹"),
      h("span", null, formatMonthKR(statsMonth)),
      h("button", { class: `arrow${isCurrent ? " dim" : ""}`, dataset: { action: "moveStatsMonth", n: "1" }, disabled: isCurrent, "aria-label": "다음달" }, "›"),
    ),
    summaryCard(stats, todoStats),
    stats.perHabit.length
      ? h("div", { class: "stat-grid" }, stats.perHabit.map((row) => habitCard(row, stats.days, weekStart)))
      : h("div", { class: "empty-state" }, h("div", { class: "big" }, "📭"), h("p", { class: "main" }, "이 달엔 기록이 없어요")),
  ];
}

const VIEWS = { month: renderMonthView, week: renderWeekView, green: renderGreenView };

export function renderStats(state) {
  const tab = state.ui.statsTab || "month";
  return h("div", { class: "screen fade-in" },
    h("div", { class: "page-title" }, "통계"),
    h("div", { class: "seg2 stats-tabs", role: "tablist" }, TABS.map(([id, label]) =>
      h("button", { class: tab === id ? "on" : "", dataset: { action: "setStatsTab", tab: id }, role: "tab", "aria-selected": String(tab === id) }, label))),
    ...VIEWS[tab](state),
  );
}

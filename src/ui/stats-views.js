import { h } from "../utils/dom.js";
import { ISO_DAYS_KR, isoWeekday, fromDateKey, weekOf, formatMonthKR, todayKey } from "../utils/date.js";
import { weeklyStats, greenLightStats, globalStreak } from "../domain/metrics.js";

const CELL_SYMBOL = { done: "■", missed: "□", off: "–", future: "·" };
const GREEN_SYMBOL = { green: "●", partial: "◑", zero: "○", none: "─", future: "" };

function weekLabel(days) {
  const first = fromDateKey(days[0]);
  const last = fromDateKey(days[6]);
  const sameMonth = first.getMonth() === last.getMonth();
  return `${first.getMonth() + 1}월 ${first.getDate()}일 ~ ${sameMonth ? "" : `${last.getMonth() + 1}월 `}${last.getDate()}일`;
}

function weekNav(days) {
  return h("div", { class: "stats-head" },
    h("button", { class: "arrow", dataset: { action: "moveStatsWeek", n: "-7" }, "aria-label": "지난주" }, "‹"),
    h("span", null, weekLabel(days)),
    h("button", { class: "arrow", dataset: { action: "moveStatsWeek", n: "7" }, "aria-label": "다음주" }, "›"),
  );
}

function weekTable(stats) {
  const head = h("div", { class: "wk-row head" },
    h("span", { class: "wk-name" }),
    stats.days.map((day) => h("span", { class: "wk-cell" }, ISO_DAYS_KR[isoWeekday(day)])),
  );
  const rows = stats.perHabit.map((row) => h("div", { class: "wk-row" },
    h("span", { class: "wk-name" }, `${row.habit.emoji} ${row.habit.name}`),
    stats.days.map((day) => h("span", { class: `wk-cell ${row.cells[day]}`, title: day }, CELL_SYMBOL[row.cells[day]])),
  ));
  return h("div", { class: "card wk-table" }, head, rows.length ? rows : h("div", { class: "card-meta" }, "이 주엔 예정된 루틴이 없어요"));
}

function dayBars(stats) {
  return h("div", { class: "card" },
    h("div", { class: "card-title", style: { marginBottom: "10px" } }, "요일별 달성률"),
    h("div", { class: "bar-list" }, stats.perDay.map(({ day, pct, future }) => h("div", { class: "bar-row" },
      h("span", { class: "bar-label" }, ISO_DAYS_KR[isoWeekday(day)]),
      h("div", { class: "progress-track" }, h("div", { class: `progress-fill${pct === 100 ? " green" : ""}`, style: { width: `${future ? 0 : (pct ?? 0)}%` } })),
      h("span", { class: "bar-pct" }, future ? "" : pct == null ? "–" : `${Math.round(pct)}%`),
    ))),
  );
}

export function renderWeekView(state) {
  const { habits, checks, settings } = state.data;
  const days = weekOf(state.ui.statsDate, settings.weekStart ?? 1);
  const stats = weeklyStats(habits, checks, days, todayKey());
  return [
    weekNav(days),
    h("div", { class: "card" },
      h("div", { class: "card-row" }, h("span", { class: "card-title" }, "📊 주간 달성률"), h("span", { class: "big-pct" }, stats.pct == null ? "–" : `${stats.pct}%`)),
      h("div", { class: "progress-track" }, h("div", { class: "progress-fill", style: { width: `${stats.pct ?? 0}%` } })),
      h("div", { class: "card-meta" }, `초록불 ${stats.greenDays}일`),
    ),
    weekTable(stats),
    dayBars(stats),
    h("div", { class: "legend" }, "■ 완료  □ 미완료  – 예정 없음  · 미래"),
  ];
}

function monthNav(month, isCurrent) {
  return h("div", { class: "stats-head" },
    h("button", { class: "arrow", dataset: { action: "moveStatsMonth", n: "-1" }, "aria-label": "지난달" }, "‹"),
    h("span", null, formatMonthKR(month)),
    h("button", { class: `arrow${isCurrent ? " dim" : ""}`, dataset: { action: "moveStatsMonth", n: "1" }, disabled: isCurrent, "aria-label": "다음달" }, "›"),
  );
}

function greenCalendar(stats, weekStart) {
  const lead = (isoWeekday(stats.days[0].day) - weekStart + 7) % 7;
  const headDays = Array.from({ length: 7 }, (_, i) => ((weekStart - 1 + i) % 7) + 1);
  return h("div", { class: "card" },
    h("div", { class: "gl-grid" },
      headDays.map((d) => h("div", { class: "gl-head" }, ISO_DAYS_KR[d])),
      Array.from({ length: lead }, () => h("div", { class: "gl-cell blank" })),
      stats.days.map(({ day, state }) => h("button", {
        class: `gl-cell ${state}`, dataset: { action: "goHomeDate", date: day }, disabled: state === "future",
        "aria-label": `${fromDateKey(day).getDate()}일 ${state}`,
      }, h("span", { class: "gl-num" }, String(fromDateKey(day).getDate())), h("span", { class: "gl-sym" }, GREEN_SYMBOL[state]))),
    ),
    h("div", { class: "legend" }, "● 초록불  ◑ 일부  ○ 0%  ─ 예정 없음 · 날짜를 탭하면 그날로 이동"),
  );
}

export function renderGreenView(state) {
  const { habits, checks, settings } = state.data;
  const today = todayKey();
  const month = state.ui.statsMonth;
  const stats = greenLightStats(habits, checks, month, today);
  const current = month === today.slice(0, 7) ? globalStreak(habits, checks, today) : null;
  return [
    monthNav(month, month === today.slice(0, 7)),
    h("div", { class: "card" },
      h("div", { class: "card-row" }, h("span", { class: "card-title" }, "🟢 이번 달 초록불"), h("span", { class: "big-pct" }, `${stats.greenDays}일`)),
      h("div", { class: "card-meta" }, `${current != null ? `현재 연속 ${current}일 · ` : ""}최장 연속 ${stats.longestStreak}일`),
    ),
    greenCalendar(stats, settings.weekStart ?? 1),
  ];
}

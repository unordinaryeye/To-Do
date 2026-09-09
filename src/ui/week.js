import { h } from "../utils/dom.js";
import { ISO_DAYS_KR, isoWeekday, fromDateKey, weekOf, todayKey, compareKeys } from "../utils/date.js";
import { activeHabits, habitsForDate, todosForDate, undoneTodos } from "../state/selectors.js";
import { isScheduled } from "../domain/schedule.js";
import { isHabitDone } from "../domain/metrics.js";
import { priorityBadges } from "../domain/todo.js";
import { emptyState } from "./parts.js";

/** 주 보기(루틴): 습관 × 7일 격자. 셀을 탭하면 그날 체크. 미래는 잠금. */
export function renderHabitWeek(state) {
  const { selectedDate, filterTagId } = state.ui;
  const { habits, checks, settings } = state.data;
  const today = todayKey();
  const days = weekOf(selectedDate, settings.weekStart ?? 1);
  const visible = activeHabits(state.data).filter((habit) => days.some((d) => habitsForDate(state.data, d, filterTagId).some((x) => x.id === habit.id)));
  if (!visible.length) return emptyState("🛌", "이번 주엔 예정된 루틴이 없어요");
  const head = h("div", { class: "wk-row head" }, h("span", { class: "wk-name" }),
    days.map((d) => h("span", { class: `wk-cell${d === today ? " today" : ""}` }, `${ISO_DAYS_KR[isoWeekday(d)]}\n${fromDateKey(d).getDate()}`)));
  const rows = visible.map((habit) => h("div", { class: "wk-row" },
    h("span", { class: "wk-name", dataset: { action: "openHabitActions", id: habit.id }, role: "button", tabindex: "0" }, `${habit.emoji} ${habit.name}`),
    days.map((d) => {
      const future = compareKeys(d, today) > 0;
      const scheduled = isScheduled(habit, d) && habitsForDate(state.data, d, filterTagId).some((x) => x.id === habit.id);
      const done = scheduled && isHabitDone(habit, checks, d);
      const cls = ["wk-check", done && "on", !scheduled && "off", future && "future"].filter(Boolean).join(" ");
      return h("button", { class: cls, dataset: scheduled && !future ? { action: "toggleCheckOn", id: habit.id, date: d } : {}, disabled: !scheduled || future,
        role: "checkbox", "aria-checked": String(done), "aria-label": `${d} ${habit.name}` }, done ? habit.emoji : scheduled ? "" : "–");
    }),
  ));
  return h("div", { class: "card wk-table home" }, head, rows);
}

/** 주 보기(투두): 요일별로 묶은 목록 */
export function renderTodoWeek(state) {
  const { selectedDate } = state.ui;
  const { settings } = state.data;
  const today = todayKey();
  const days = weekOf(selectedDate, settings.weekStart ?? 1);
  const sections = days.map((d) => {
    const todos = todosForDate(state.data, d);
    const undone = undoneTodos(state.data, d).length;
    return h("div", { class: `tw-day${d === today ? " today" : ""}` },
      h("div", { class: "tw-head", dataset: { action: "selectDateDay", date: d }, role: "button", tabindex: "0" },
        h("span", null, `${ISO_DAYS_KR[isoWeekday(d)]} ${fromDateKey(d).getDate()}일`),
        h("span", { class: "mx-count" }, todos.length ? `${todos.length - undone}/${todos.length}` : "")),
      todos.length ? todos.map((t) => h("div", { class: `tw-item${t.done ? " done" : ""}` },
        h("button", { class: `mx-check${t.done ? " on" : ""}`, dataset: { action: "toggleTodo", id: t.id }, role: "checkbox", "aria-checked": String(t.done), "aria-label": t.title }, t.done ? "✔" : ""),
        h("span", { class: "mx-title", dataset: { action: "openTodoActions", id: t.id }, role: "button", tabindex: "0" },
          t.time ? h("span", { class: "mx-time" }, t.time) : null, priorityBadges(t) ? `${priorityBadges(t)} ` : "", t.title),
      )) : h("div", { class: "mx-hint" }, "없음"),
    );
  });
  return h("div", { class: "tw-list" }, sections);
}

import { h } from "../utils/dom.js";
import { ISO_DAYS_KR, weekOf, isoWeekday, fromDateKey, formatMonthKR, monthKey, todayKey } from "../utils/date.js";
import { habitsForDate, todosForDate, tagsInUse, activeHabits } from "../state/selectors.js";
import { dayStatus, dayProgress, globalStreak, habitStreak, isHabitDone } from "../domain/metrics.js";
import { currentPolicy } from "../domain/schedule.js";
import { repeatLabel, triggerLabel } from "../domain/format.js";
import { needsBackupReminder } from "../storage/local.js";
import { chip, emptyState } from "./parts.js";

function header(state) {
  const { selectedDate } = state.ui;
  const streak = globalStreak(state.data.habits, state.data.checks, todayKey());
  return h("div", { class: "home-head" },
    h("button", { class: "month-btn", dataset: { action: "goToday" } }, formatMonthKR(monthKey(selectedDate)), h("span", { class: "chev" }, "▾")),
    h("div", { class: "head-right" },
      h("div", { class: `streak-badge${streak > 0 ? " hot" : ""}` }, "🔥", String(streak)),
      h("button", { class: "icon-btn", dataset: { action: "openSettingsRoute" }, "aria-label": "설정" }, "⋯"),
    ),
  );
}

function donut(status, dayNum, selected) {
  const pct = status.pct;
  const cls = ["donut", status.allDone && "green", pct == null && "none"].filter(Boolean).join(" ");
  const style = pct != null && !status.allDone
    ? { background: `conic-gradient(var(--yellow) ${pct}%, var(--line) 0)` }
    : undefined;
  return h("div", { class: cls, style, "aria-label": pct == null ? "예정 없음" : `${Math.round(pct)}%` },
    h("span", { class: "num" }, String(dayNum)));
}

function weekStrip(state) {
  const { selectedDate } = state.ui;
  const { habits, checks, settings } = state.data;
  const today = todayKey();
  const days = weekOf(selectedDate, settings.weekStart ?? 1).map((key) => {
    const status = dayStatus(habits, checks, key);
    const cls = ["week-day", key === selectedDate && "selected", key === today && "today"].filter(Boolean).join(" ");
    return h("button", { class: cls, dataset: { action: "selectDate", date: key } },
      h("span", { class: "lbl" }, ISO_DAYS_KR[isoWeekday(key)]),
      donut(status, fromDateKey(key).getDate(), key === selectedDate),
    );
  });
  return h("div", { class: "week-strip" },
    h("button", { class: "arrow", dataset: { action: "moveDate", n: "-7" }, "aria-label": "지난주" }, "‹"),
    h("div", { class: "week-days" }, days),
    h("button", { class: "arrow", dataset: { action: "moveDate", n: "7" }, "aria-label": "다음주" }, "›"),
  );
}

function segment(tab) {
  const btn = (id, label) => h("button", { class: `seg-btn${tab === id ? " active" : ""}`, dataset: { action: "setHomeTab", tab: id } }, label);
  return h("div", { class: "segment" }, btn("habits", "루틴"), btn("todos", "투두"));
}

function filterRow(state) {
  const tags = tagsInUse(state.data, todayKey());
  return h("div", { class: "filter-row" },
    chip("하루", { dark: true }),
    tags.map((tag) => chip(`${tag.emoji} ${tag.name}`, {
      on: state.ui.filterTagId === tag.id,
      dataset: { action: "toggleFilterTag", id: tag.id },
    })),
  );
}

function whenCell(habit, policy, clock24, dataset) {
  const trigger = policy?.trigger;
  return h("div", { class: "cell when", dataset },
    h("span", { class: `t${trigger?.type === "context" ? " ctx" : ""}` }, triggerLabel(trigger, clock24)),
    h("span", { class: "d" }, repeatLabel(policy?.repeat.days)),
  );
}

function habitRow(habit, index, state) {
  const { selectedDate } = state.ui;
  const { checks, settings } = state.data;
  const done = isHabitDone(habit, checks, selectedDate);
  const policy = currentPolicy(habit, selectedDate);
  const streak = habitStreak(habit, checks, selectedDate);
  return h("div", { class: "row", dataset: { habitId: habit.id } },
    h("div", { class: `cell check${done ? " on check-pop" : ""}`, dataset: { action: "toggleCheck", id: habit.id }, role: "checkbox", "aria-checked": String(done), "aria-label": habit.name },
      done ? habit.emoji : ""),
    whenCell(habit, policy, settings.clock24, { action: "openSchedule", id: habit.id }),
    h("div", { class: "cell name", dataset: { action: "openHabitActions", id: habit.id } },
      h("span", { class: "rank" }, String(index + 1)),
      h("span", { class: "txt" }, `${habit.emoji} ${habit.name}`),
      streak > 0 ? h("span", { class: "fire hot" }, `🔥${streak}`) : null,
    ),
  );
}

function habitsTab(state) {
  const { selectedDate, filterTagId } = state.ui;
  const habits = habitsForDate(state.data, selectedDate, filterTagId);
  const hasAny = activeHabits(state.data).length > 0;
  if (!habits.length) {
    return hasAny
      ? emptyState("🛌", "오늘은 예정된 루틴이 없어요", filterTagId ? "필터를 해제해 보세요" : "투두 탭을 확인해 볼까요?")
      : emptyState("🌱", "첫 번째 루틴을 만들어 보세요", "오른쪽 아래 + 버튼을 눌러요");
  }
  return h("div", { class: "table" }, habits.map((habit, i) => habitRow(habit, i, state)));
}

function todoRow(todo, index, state) {
  const today = todayKey();
  const late = todo.time && !todo.done && state.ui.selectedDate === today && todo.time < new Date().toTimeString().slice(0, 5);
  return h("div", { class: "row todo-row" },
    h("div", { class: `cell check todo${todo.done ? " on check-pop" : ""}`, dataset: { action: "toggleTodo", id: todo.id }, role: "checkbox", "aria-checked": String(todo.done) },
      todo.done ? "✔" : ""),
    h("div", { class: "cell when", dataset: { action: "openTodoForm", id: todo.id } },
      h("span", { class: `t${late ? " late" : ""}` }, todo.time ? `${todo.time}${late ? "!" : ""}` : "–")),
    h("div", { class: "cell name", dataset: { action: "openTodoActions", id: todo.id } },
      h("span", { class: "rank" }, String(index + 1)),
      h("span", { class: `txt${todo.done ? " done" : ""}` }, todo.title),
    ),
  );
}

function todosTab(state, drafts) {
  const todos = todosForDate(state.data, state.ui.selectedDate);
  return h("div", null,
    todos.length
      ? h("div", { class: "table" }, todos.map((todo, i) => todoRow(todo, i, state)))
      : emptyState("📌", "할 일이 없어요", "아래 입력창이나 + 버튼으로 추가해요"),
    h("div", { class: "quick-add" },
      h("input", { id: "todoInputField", value: drafts.todo, placeholder: "할 일 빠른 추가", dataset: { draft: "todo", enter: "quickAddTodo" } }),
      h("button", { class: "btn dark", dataset: { action: "quickAddTodo" } }, "추가"),
    ),
  );
}

function completeBanner(state) {
  const { selectedDate } = state.ui;
  const { habits, checks } = state.data;
  const progress = dayProgress(habits, checks, todosForDate(state.data, selectedDate), selectedDate);
  if (progress.total === 0 || progress.pct < 100) return null;
  return h("div", { class: "complete-banner fade-in" },
    h("div", { style: { fontSize: "36px", marginBottom: "8px" } }, "🎉"),
    h("p", { class: "complete-main" }, "오늘 할 일 모두 완료!"),
    h("p", { class: "complete-sub" }, "대단해요, 꾸준함이 실력입니다"),
  );
}

export function renderHome(state, drafts) {
  const tab = state.ui.homeTab;
  return h("div", { class: "screen fade-in" },
    header(state),
    weekStrip(state),
    needsBackupReminder(state.data, state.ui.syncCode) ? h("div", { class: "backup-banner", dataset: { action: "goRoute", route: "settings" } },
      h("span", { style: { fontSize: "22px" } }, "💾"),
      h("div", null, h("div", { class: "banner-main" }, "데이터 백업을 해두면 안전해요"), h("div", { class: "banner-sub" }, "탭해서 백업하기 →")),
    ) : null,
    segment(tab),
    h("div", { class: "home-body" },
      tab === "habits" ? filterRow(state) : null,
      tab === "habits" ? habitsTab(state) : todosTab(state, drafts),
      completeBanner(state),
    ),
    h("button", { class: "fab", dataset: { action: "openFab" }, "aria-label": "추가" }, "+"),
  );
}

import { TODO_COLOR, COLOR_DONE, COLOR_PARTIAL, COLOR_NONE, COLOR_LOW } from "../config.js";
import { h } from "../utils/dom.js";
import { DAYS_KR, formatKR, fromDateKey, surroundingWeek, todayKey } from "../utils/date.js";
import { groupedForDate, todosForDate } from "../state/selectors.js";
import { dayProgress, dayStatus, globalStreak, isHabitDone } from "../domain/metrics.js";
import { needsBackupReminder } from "../storage/local.js";
import { moveButtons, checkbox, groupHeader, emptyState } from "./parts.js";

export function renderDateNav(state) {
  const { selectedDate } = state.ui;
  const { habits, checks } = state.data;
  const nav = h("div", { class: "date-nav" },
    h("button", { class: "arrow", dataset: { action: "moveDate", n: "-1" } }, "‹"),
    h("span", { class: "date-text" }, formatKR(selectedDate)),
    h("button", { class: "arrow", dataset: { action: "moveDate", n: "1" } }, "›"),
    selectedDate !== todayKey() ? h("button", { class: "today-btn", dataset: { action: "goToday" } }, "오늘") : null,
  );
  const week = h("div", { class: "week-row" }, surroundingWeek(selectedDate).map((key) => {
    const status = dayStatus(habits, checks, key);
    const dot = status.allDone ? COLOR_DONE : status.done > 0 ? COLOR_PARTIAL : COLOR_NONE;
    const d = fromDateKey(key);
    return h("button", { class: `week-day${key === selectedDate ? " selected" : ""}`, dataset: { action: "selectDate", date: key } },
      h("span", { class: "lbl" }, DAYS_KR[d.getDay()]),
      h("span", { class: "num" }, String(d.getDate())),
      h("div", { class: "dot", style: { background: dot } }),
    );
  }));
  return h("div", { class: "fade-in" }, nav, week);
}

function statsCards(progress, streak) {
  const color = progress.pct === 100 ? COLOR_DONE : progress.pct > 50 ? COLOR_PARTIAL : COLOR_LOW;
  return h("div", { class: "stats" },
    h("div", { class: "stat-card", style: { flex: "1" } },
      h("div", { class: "label" }, "진행률"),
      h("div", { class: "stat-row" },
        h("div", { class: "progress-track" }, h("div", { class: "progress-fill progress-bar", style: { width: `${progress.pct}%`, background: color } })),
        h("span", { class: "stat-number" }, `${progress.done}/${progress.total}`),
      ),
    ),
    h("div", { class: "stat-card stat-streak" },
      h("div", { class: "label" }, "연속"),
      h("div", null, h("span", { class: "streak-number" }, String(streak)), h("span", { class: "streak-unit" }, "일")),
    ),
  );
}

function habitRow(habit, checked, color, position) {
  return h("div", { class: "routine-item" },
    checkbox(checked, color, { action: "toggleCheck", id: habit.id }),
    h("span", { class: "routine-emoji", dataset: { action: "toggleCheck", id: habit.id } }, habit.emoji),
    h("span", { class: `routine-text${checked ? " done" : ""}`, style: { flex: "1" }, dataset: { action: "toggleCheck", id: habit.id } }, habit.name),
    moveButtons("moveHabit", habit.id, position),
  );
}

function habitGroups(state) {
  const { selectedDate } = state.ui;
  const { checks } = state.data;
  return groupedForDate(state.data, selectedDate).map((group, gi) => {
    const doneCount = group.items.filter((habit) => isHabitDone(habit, checks, selectedDate)).length;
    return h("div", { class: "group slide-in", style: { animationDelay: `${gi * 0.05}s` } },
      groupHeader(group.color, group.label, `${doneCount}/${group.items.length}`),
      h("div", { class: "group-card" }, group.items.map((habit, i) => habitRow(
        habit, isHabitDone(habit, checks, selectedDate), group.color,
        { isFirst: i === 0, isLast: i === group.items.length - 1 },
      ))),
    );
  });
}

function todoRow(todo, editingId, position) {
  const editing = editingId === todo.id;
  const title = editing
    ? h("input", { class: "edit-input", id: `editTodo-${todo.id}`, value: todo.title, dataset: { action: "commitTodoEdit", id: todo.id } })
    : h("span", { class: `routine-text${todo.done ? " done" : ""}`, style: { flex: "1", cursor: "text" }, dataset: { action: "editTodo", id: todo.id } }, todo.title);
  return h("div", { class: "routine-item" },
    checkbox(todo.done, TODO_COLOR, { action: "toggleTodo", id: todo.id }),
    title,
    moveButtons("moveTodo", todo.id, { ...position, marginRight: true }),
    h("button", { class: "todo-delete", dataset: { action: "deleteTodo", id: todo.id }, "aria-label": "삭제" }, "×"),
  );
}

function todoSection(state, todos, delay, draft) {
  const doneCount = todos.filter((t) => t.done).length;
  return h("div", { class: "group slide-in", style: { animationDelay: `${delay}s`, marginTop: "24px" } },
    groupHeader(TODO_COLOR, "📌 오늘의 할 일", `${doneCount}/${todos.length}`),
    todos.length ? h("div", { class: "group-card" }, todos.map((todo, i) => todoRow(
      todo, state.ui.editingTodoId, { isFirst: i === 0, isLast: i === todos.length - 1 },
    ))) : null,
    h("div", { class: "todo-add-row" },
      h("input", { id: "todoInputField", class: "text-input todo-input", value: draft, placeholder: "할 일을 입력하세요", dataset: { draft: "todo", enter: "addTodo" } }),
      h("button", { class: "add-btn todo-add-btn", dataset: { action: "addTodo" } }, "추가"),
    ),
  );
}

export function renderDaily(state, drafts) {
  const { selectedDate } = state.ui;
  const { habits, checks } = state.data;
  const todos = todosForDate(state.data, selectedDate);
  const progress = dayProgress(habits, checks, todos, selectedDate);
  const groups = habitGroups(state);
  const hasHabits = Object.values(habits).some((habit) => !habit.deletedAt);

  return h("div", { class: "content fade-in" },
    needsBackupReminder(state.data, state.ui.syncCode) ? h("div", { class: "backup-banner", dataset: { action: "openSettings" } },
      h("span", { style: { fontSize: "22px" } }, "💾"),
      h("div", null,
        h("div", { class: "banner-main" }, "데이터 백업을 해두면 안전해요"),
        h("div", { class: "banner-sub" }, "탭해서 백업하기 →"),
      ),
    ) : null,
    statsCards(progress, globalStreak(habits, checks, selectedDate)),
    groups,
    todoSection(state, todos, groups.length * 0.05, drafts.todo),
    !hasHabits && !todos.length ? emptyState("📋",
      h("p", { class: "empty-main" }, "등록된 루틴이 없습니다"),
      h("p", { class: "empty-sub" }, h("span", { class: "link", dataset: { action: "setView", view: "routines" } }, "루틴 관리"), "에서 추가해보세요"),
    ) : null,
    progress.pct === 100 && progress.total > 0 ? h("div", { class: "complete-banner fade-in" },
      h("div", { style: { fontSize: "36px", marginBottom: "8px" } }, "🎉"),
      h("p", { class: "complete-main" }, "오늘 할 일 모두 완료!"),
      h("p", { class: "complete-sub" }, "대단해요, 꾸준함이 실력입니다"),
    ) : null,
  );
}

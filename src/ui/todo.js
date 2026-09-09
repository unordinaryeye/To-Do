import { h } from "../utils/dom.js";
import { todayKey } from "../utils/date.js";
import { todosForDate, quadrantGroups } from "../state/selectors.js";
import { QUADRANTS, priorityBadges } from "../domain/todo.js";
import { emptyState } from "./parts.js";

function checkCell(todo) {
  return h("div", {
    class: `cell check todo${todo.done ? " on check-pop" : ""}`,
    dataset: { action: "toggleTodo", id: todo.id }, role: "checkbox", tabindex: "0",
    "aria-checked": String(todo.done), "aria-label": todo.title,
  }, todo.done ? "✔" : "");
}

function listRow(todo, index, state, now) {
  const late = todo.time && !todo.done && state.ui.selectedDate === todayKey() && todo.time < now;
  const badges = priorityBadges(todo);
  return h("div", { class: "row todo-row" },
    checkCell(todo),
    h("div", { class: "cell when", dataset: { action: "openTodoForm", id: todo.id }, role: "button", tabindex: "0", "aria-label": "시간 설정" },
      h("span", { class: `t${late ? " late" : ""}` }, todo.time ? `${todo.time}${late ? "!" : ""}` : "–")),
    h("div", { class: "cell name", dataset: { action: "openTodoActions", id: todo.id }, role: "button", tabindex: "0" },
      h("span", { class: "rank" }, String(index + 1)),
      h("span", { class: `txt${todo.done ? " done" : ""}` }, badges ? `${badges} ${todo.title}` : todo.title),
    ),
  );
}

/** 오늘 목록에서 현재 시각 위치에 얇은 "지금" 구분선을 넣는다. */
function withNowMarker(rows, todos, state, now) {
  if (state.ui.selectedDate !== todayKey()) return rows;
  const index = todos.findIndex((t) => !t.time || t.time > now);
  if (index <= 0 || !todos[index - 1].time) return rows;
  return [...rows.slice(0, index), h("div", { class: "now-line" }, h("span", null, `지금 ${now}`)), ...rows.slice(index)];
}

function listView(state, todos, now) {
  if (!todos.length) return emptyState("📌", "할 일이 없어요", "아래 입력창이나 + 버튼으로 추가해요");
  const rows = todos.map((todo, i) => listRow(todo, i, state, now));
  return h("div", { class: "table" }, withNowMarker(rows, todos, state, now));
}

function matrixItem(todo) {
  return h("div", { class: `mx-item${todo.done ? " done" : ""}` },
    h("button", { class: `mx-check${todo.done ? " on" : ""}`, dataset: { action: "toggleTodo", id: todo.id }, role: "checkbox", "aria-checked": String(todo.done), "aria-label": todo.title }, todo.done ? "✔" : ""),
    h("span", { class: "mx-title", dataset: { action: "openTodoActions", id: todo.id }, role: "button", tabindex: "0" },
      todo.time ? h("span", { class: "mx-time" }, todo.time) : null, todo.title),
  );
}

function quadrantCell(q, items) {
  return h("div", { class: `mx-cell ${q.id}` },
    h("div", { class: "mx-head" }, h("span", null, `${q.icon} ${q.label}`), h("span", { class: "mx-count" }, String(items.length))),
    items.length ? items.map(matrixItem) : h("div", { class: "mx-hint" }, q.hint),
    h("button", { class: "mx-add", dataset: { action: "openTodoForm", quadrant: q.id } }, "+ 추가"),
  );
}

function matrixView(state, groups) {
  const unclassified = groups.none;
  return h("div", null,
    h("div", { class: "matrix" }, QUADRANTS.map((q) => quadrantCell(q, groups[q.id]))),
    h("div", { class: "mx-unclassified" },
      h("div", { class: "mx-head" }, h("span", null, `미분류 ${unclassified.length}`), unclassified.length ? h("span", { class: "mx-hint" }, "항목을 탭해 사분면에 넣어요") : null),
      unclassified.map(matrixItem),
    ),
  );
}

export function renderTodosTab(state, drafts) {
  const { selectedDate } = state.ui;
  const view = state.data.settings.todoView === "matrix" ? "matrix" : "list";
  const todos = todosForDate(state.data, selectedDate);
  const now = new Date().toTimeString().slice(0, 5);
  const toggle = (id, icon, label) => h("button", { class: `view-btn${view === id ? " on" : ""}`, dataset: { action: "setTodoView", view: id }, "aria-label": label, "aria-pressed": String(view === id) }, icon);
  return h("div", null,
    h("div", { class: "filter-row" },
      h("span", { class: "chip dark" }, "하루"),
      h("span", { class: "spacer" }),
      h("div", { class: "view-toggle" }, toggle("list", "☰", "리스트 보기"), toggle("matrix", "⊞", "매트릭스 보기")),
    ),
    view === "matrix" ? matrixView(state, quadrantGroups(state.data, selectedDate)) : listView(state, todos, now),
    h("div", { class: "quick-add" },
      h("input", { id: "todoInputField", value: drafts.todo, placeholder: "할 일 빠른 추가 (예: 14:00 병원)", maxlength: "60", dataset: { draft: "todo", enter: "quickAddTodo" }, "aria-label": "할 일 빠른 추가" }),
      h("button", { class: "btn dark", dataset: { action: "quickAddTodo" } }, "추가"),
    ),
  );
}

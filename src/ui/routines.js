import { CATEGORIES, EMOJI_OPTIONS } from "../config.js";
import { h } from "../utils/dom.js";
import { groupedAll } from "../state/selectors.js";
import { moveButtons, groupHeader, emptyState } from "./parts.js";

function emojiPicker(current) {
  return h("div", { class: "emoji-picker" }, EMOJI_OPTIONS.map((emoji) =>
    h("button", { class: `emoji-option${current === emoji ? " selected" : ""}`, dataset: { action: "pickEmoji", emoji } }, emoji),
  ));
}

function addForm(ui, draft) {
  return h("div", { class: "add-form" },
    h("div", { class: "title" }, "새 루틴 추가"),
    h("div", { class: "add-row" },
      h("div", { style: { position: "relative" } },
        h("button", { class: "emoji-btn", dataset: { action: "toggleEmojiPicker" } }, ui.newEmoji),
        ui.showEmojiPicker ? emojiPicker(ui.newEmoji) : null,
      ),
      h("input", { class: "text-input", id: "newRoutineField", value: draft, placeholder: "루틴 이름을 입력하세요", dataset: { draft: "newRoutine", enter: "addHabit" } }),
    ),
    h("div", { class: "add-row-bottom" },
      h("select", { class: "select-input", dataset: { action: "pickCategory" } }, CATEGORIES.map((c) =>
        h("option", { value: c.id, selected: ui.newCategory === c.id }, c.label),
      )),
      h("button", { class: "add-btn", dataset: { action: "addHabit" } }, "추가"),
    ),
  );
}

function habitRow(habit, editingId, position) {
  const editing = editingId === habit.id;
  const name = editing
    ? h("input", { class: "edit-input", id: `edit-${habit.id}`, value: habit.name, dataset: { action: "commitHabitEdit", id: habit.id } })
    : h("span", { class: "routine-text", style: { flex: "1", cursor: "text" }, dataset: { action: "editHabit", id: habit.id } }, habit.name);
  return h("div", { class: "routine-item" },
    h("span", { class: "routine-emoji", style: { fontSize: "16px" } }, habit.emoji),
    name,
    moveButtons("moveHabit", habit.id, { ...position, marginRight: true }),
    h("button", { class: "delete-btn", dataset: { action: "deleteHabit", id: habit.id }, "aria-label": "삭제" }, "×"),
  );
}

export function renderRoutines(state, drafts) {
  const groups = groupedAll(state.data);
  return h("div", { class: "content fade-in" },
    addForm(state.ui, drafts.newRoutine),
    groups.map((group, gi) => h("div", { class: "group slide-in", style: { animationDelay: `${gi * 0.05}s` } },
      groupHeader(group.color, group.label, `(${group.items.length})`),
      h("div", { class: "group-card" }, group.items.map((habit, i) => habitRow(
        habit, state.ui.editingId, { isFirst: i === 0, isLast: i === group.items.length - 1 },
      ))),
    )),
    groups.length ? null : emptyState("🌱", h("p", { class: "empty-main" }, "위에서 첫 번째 루틴을 추가해보세요")),
  );
}

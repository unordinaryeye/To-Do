import { h } from "../utils/dom.js";
import { currentPolicy } from "../domain/schedule.js";
import { repeatLabel, triggerLabel } from "../domain/format.js";
import { activeHabits } from "../state/selectors.js";
import { sheet, actionItem, confirmBox } from "./parts.js";
import { scheduleEditor, emojiGrid, todoFormBody } from "./forms.js";

function habitSummary(habit, policy, clock24) {
  return h("div", { class: "sheet-summary" },
    h("span", { class: "emoji" }, habit.emoji),
    h("div", null,
      h("div", { class: "name" }, habit.name),
      h("div", { class: "meta" }, `${triggerLabel(policy?.trigger, clock24)} · ${repeatLabel(policy?.repeat.days)}`),
    ),
  );
}

function habitActions(state, id) {
  const habit = state.data.habits[id];
  if (!habit) return null;
  const list = activeHabits(state.data);
  const index = list.findIndex((h) => h.id === id);
  const policy = currentPolicy(habit, state.ui.selectedDate);
  return sheet([
    habitSummary(habit, policy, state.data.settings.clock24),
    actionItem("수정하기", "✏️", { action: "openHabitForm", id }),
    actionItem("시간·반복 바꾸기", "🕒", { action: "openSchedule", id }),
    actionItem("위로 이동", "▲", { action: "moveHabit", id, dir: "-1" }, { disabled: index <= 0 }),
    actionItem("아래로 이동", "▼", { action: "moveHabit", id, dir: "1" }, { disabled: index >= list.length - 1 }),
    actionItem("삭제하기", "🗑", { action: "askDeleteHabit", id }, { danger: true }),
    h("button", { class: "sheet-close", dataset: { action: "closeSheet" } }, "닫기"),
  ]);
}

function todoActions(state, id) {
  const todo = state.data.todos[id];
  if (!todo) return null;
  return sheet([
    h("div", { class: "sheet-summary" }, h("span", { class: "emoji" }, "📌"), h("div", null, h("div", { class: "name" }, todo.title))),
    actionItem("수정하기", "✏️", { action: "openTodoForm", id }),
    actionItem("위로 이동", "▲", { action: "moveTodo", id, dir: "-1" }, { disabled: !!todo.time }),
    actionItem("아래로 이동", "▼", { action: "moveTodo", id, dir: "1" }, { disabled: !!todo.time }),
    actionItem("삭제하기", "🗑", { action: "askDeleteTodo", id }, { danger: true }),
    h("button", { class: "sheet-close", dataset: { action: "closeSheet" } }, "닫기"),
  ]);
}

/** 홈 표의 시간·요일 셀에서 여는 빠른 설정 */
function scheduleSheet(state, drafts) {
  const { values } = state.ui.sheet;
  const habit = state.data.habits[values.id];
  const valid = values.repeatDays.length > 0 && (values.triggerType !== "time" || !!values.triggerTime);
  return sheet([
    scheduleEditor(values, drafts),
    h("button", { class: "btn primary block big", dataset: { action: "submitSchedule" }, disabled: !valid }, "확인"),
  ], { title: `${habit?.emoji ?? ""} ${habit?.name ?? ""}`, sub: "바뀐 설정은 오늘부터 적용돼요. 지난 기록은 그대로 남아요." });
}

function fabMenu(state) {
  const item = (label, sub, icon, dataset) => h("div", { class: "fab-item", dataset },
    h("div", null, h("div", { class: "lbl" }, label), h("div", { class: "sub" }, sub)),
    h("div", { class: "circle" }, icon));
  const habit = item("루틴 추가", "반복하는 습관", "✔", { action: "openHabitForm" });
  const todo = item("투두 추가", "오늘 한 번 할 일", "📌", { action: "openTodoForm" });
  const first = state.ui.homeTab === "todos" ? [todo, habit] : [habit, todo];
  return h("div", { class: "fab-menu", dataset: { action: "closeSheet" } },
    ...first,
    h("div", { class: "fab-item close", dataset: { action: "closeSheet" } }, h("div", { class: "circle" }, "✕")),
  );
}

export function renderSheet(state, drafts) {
  const s = state.ui.sheet;
  if (!s) return null;
  switch (s.type) {
    case "habitActions": return habitActions(state, s.id);
    case "todoActions": return todoActions(state, s.id);
    case "schedule": return scheduleSheet(state, drafts);
    case "todoForm": return sheet(todoFormBody(s.values, drafts), { title: s.values.id ? "할 일 수정" : "할 일 추가" });
    case "emoji": return sheet([emojiGrid(state.ui.page?.values.emoji)], { title: "이모지 선택" });
    case "fab": return fabMenu(state);
    case "confirmDeleteHabit": {
      const name = state.data.habits[s.id]?.name ?? "";
      return confirmBox([`"${name}" 루틴을 삭제할까요?`, h("br"), "지난 기록도 함께 사라져요."], "삭제", { action: "deleteHabit", id: s.id });
    }
    case "confirmDeleteTodo":
      return confirmBox("이 할 일을 삭제할까요?", "삭제", { action: "deleteTodo", id: s.id });
    case "confirmReset":
      return confirmBox(["모든 루틴과 기록이 삭제됩니다.", h("br"), "정말 초기화할까요?"], "초기화", { action: "reset" });
    default: return null;
  }
}

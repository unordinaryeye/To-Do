import { h } from "../utils/dom.js";
import { todayKey, formatDateDots } from "../utils/date.js";
import { currentPolicy } from "../domain/schedule.js";
import { repeatLabel, triggerLabel } from "../domain/format.js";
import { habitMoveBounds, todoMoveBounds, endedHabits, pausedHabits, activeTags } from "../state/selectors.js";
import { monthlyStats, habitStreak } from "../domain/metrics.js";
import { addDays, weekOf } from "../utils/date.js";
import { sheet, actionItem, confirmBox, listItem } from "./parts.js";
import { scheduleEditor, emojiGrid } from "./forms.js";
import { QUADRANTS, quadrantOf } from "../domain/todo.js";

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
  const date = state.ui.selectedDate;
  const bounds = habitMoveBounds(state.data, id, date);
  const policy = currentPolicy(habit, date);
  return sheet([
    habitSummary(habit, policy, state.data.settings.clock24),
    actionItem("수정하기", "✏️", { action: "openHabitForm", id }),
    actionItem("시간·반복 바꾸기", "🕒", { action: "openSchedule", id }),
    bounds.byTime
      ? actionItem("시간순으로 자동 정렬 중", "🕒", { action: "openSchedule", id }, { disabled: false })
      : actionItem("위로 이동", "▲", { action: "moveHabit", id, dir: "-1" }, { disabled: !bounds.up }),
    bounds.byTime ? null : actionItem("아래로 이동", "▼", { action: "moveHabit", id, dir: "1" }, { disabled: !bounds.down }),
    actionItem("월간 기록", "📊", { action: "openHabitRecord", id }),
    actionItem("복사하기", "📋", { action: "copyHabit", id }),
    actionItem("쉬어가기", "🛌", { action: "openPauseSheet", id }),
    actionItem("끝내기", "⛔", { action: "askEndHabit", id }),
    actionItem("삭제하기", "🗑", { action: "askDeleteHabit", id }, { danger: true }),
    h("button", { class: "sheet-close", dataset: { action: "closeSheet" } }, "닫기"),
  ]);
}

function todoActions(state, id) {
  const todo = state.data.todos[id];
  if (!todo) return null;
  const bounds = todoMoveBounds(state.data, todo);
  return sheet([
    h("div", { class: "sheet-summary" }, h("span", { class: "emoji" }, "📌"), h("div", null, h("div", { class: "name" }, todo.title),
      todo.time ? h("div", { class: "meta" }, "시간이 있는 할 일은 시간순으로 정렬돼요") : null)),
    actionItem("수정하기", "✏️", { action: "openTodoForm", id }),
    actionItem(`사분면 이동 · ${quadrantOf(todo)?.label ?? "미분류"}`, "⊞", { action: "openQuadrantPicker", id }),
    actionItem("습관으로 만들기", "🔁", { action: "openHabitForm", fromTodo: id }),
    actionItem("위로 이동", "▲", { action: "moveTodo", id, dir: "-1" }, { disabled: !bounds.up }),
    actionItem("아래로 이동", "▼", { action: "moveTodo", id, dir: "1" }, { disabled: !bounds.down }),
    actionItem("삭제하기", "🗑", { action: "askDeleteTodo", id }, { danger: true }),
    h("button", { class: "sheet-close", dataset: { action: "closeSheet" } }, "닫기"),
  ]);
}

/** 홈 표의 시간·요일 셀에서 여는 빠른 설정 */
function scheduleSheet(state, drafts) {
  const { values } = state.ui.sheet;
  const habit = state.data.habits[values.id];
  const future = drafts.startDate > todayKey();
  return sheet([
    scheduleEditor(values, drafts),
    h("button", { class: "btn primary block big", dataset: { action: "submitSchedule" } }, "확인"),
  ], {
    title: `${habit?.emoji ?? ""} ${habit?.name ?? ""}`,
    sub: future ? "바뀐 설정은 시작 날짜부터 적용돼요." : "바뀐 설정은 오늘부터 적용돼요. 지난 기록은 그대로 남아요.",
  });
}

function quadrantPicker(state, id) {
  const todo = state.data.todos[id];
  if (!todo) return null;
  const current = quadrantOf(todo)?.id ?? "none";
  const cell = (qid, icon, label, hint) => h("button", { class: `qp-cell${current === qid ? " on" : ""}`, dataset: { action: "setQuadrant", id, quadrant: qid } },
    h("span", { class: "qp-icon" }, icon), h("span", { class: "qp-label" }, label), h("span", { class: "qp-hint" }, hint));
  return sheet([
    h("div", { class: "qp-grid" }, QUADRANTS.map((q) => cell(q.id, q.icon, q.label, q.hint))),
    cell("none", "📥", "미분류", "아직 정하지 않음"),
    h("button", { class: "sheet-close", dataset: { action: "closeSheet" } }, "닫기"),
  ], { title: todo.title, sub: "긴급·중요 여부로 사분면을 고릅니다" });
}

function tagManageSheet(state) {
  const tags = activeTags(state.data);
  return sheet([
    tags.length
      ? tags.map((tag) => listItem({
        icon: tag.emoji, iconBg: `${tag.color}22`, main: tag.name, isStatic: true,
        right: [
          h("button", { class: "btn ghost sm", dataset: { action: "openTagForm", id: tag.id } }, "수정"),
          h("button", { class: "btn danger-ghost sm", dataset: { action: "askDeleteTag", id: tag.id } }, "삭제"),
        ],
      }))
      : h("div", { class: "empty-state" }, h("p", { class: "main" }, "목표 태그가 없어요")),
    h("button", { class: "btn primary block", dataset: { action: "openTagForm" } }, "+ 새 목표 만들기"),
    h("button", { class: "sheet-close", dataset: { action: "closeSheet" } }, "닫기"),
  ], { title: "목표 태그 관리", sub: "삭제해도 루틴은 남고 태그만 빠져요. 루틴에 태그를 붙이려면 루틴 수정 → 목표 태그." });
}

function tagActions(state, id) {
  const tag = state.data.goalTags[id];
  if (!tag) return null;
  return sheet([
    h("div", { class: "sheet-summary" }, h("span", { class: "emoji" }, tag.emoji), h("div", null, h("div", { class: "name" }, tag.name))),
    actionItem("수정하기", "✏️", { action: "openTagForm", id }),
    actionItem("삭제하기", "🗑", { action: "askDeleteTag", id }, { danger: true }),
    h("button", { class: "sheet-close", dataset: { action: "closeSheet" } }, "닫기"),
  ]);
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

/** 종료·휴식 중인 루틴 목록: 다시 시작으로 복구할 수 있다. */
function endedSheet(state) {
  const today = todayKey();
  const rows = [
    ...endedHabits(state.data, today).map((habit) => ({ habit, sub: `${formatDateDots(habit.endDate)} 종료` })),
    ...pausedHabits(state.data, today).map((habit) => ({ habit, sub: "쉬는 중" })),
  ];
  return sheet([
    rows.length
      ? rows.map(({ habit, sub }) => listItem({
        icon: habit.emoji, main: habit.name, sub,
        right: h("button", { class: "btn ghost", dataset: { action: "resumeHabit", id: habit.id } }, "다시 시작"),
        isStatic: true,
      }))
      : h("div", { class: "empty-state" }, h("p", { class: "main" }, "끝냈거나 쉬는 루틴이 없어요")),
    h("button", { class: "sheet-close", dataset: { action: "closeSheet" } }, "닫기"),
  ], { title: "끝낸·쉬는 루틴", sub: "다시 시작하면 오늘부터 다시 예정돼요. 지난 기록은 그대로예요." });
}

function pauseSheet(state, id) {
  const habit = state.data.habits[id];
  if (!habit) return null;
  const today = todayKey();
  const week = weekOf(today, state.data.settings.weekStart ?? 1);
  const option = (label, sub, until) => actionItem(`${label} · ${sub}`, "›", { action: "pauseHabit", id, until: until ?? "" });
  return sheet([
    option("오늘만", "내일부터 다시", today),
    option("내일까지", `${formatDateDots(addDays(today, 1))}까지`, addDays(today, 1)),
    option("이번 주 끝까지", `${formatDateDots(week[6])}까지`, week[6]),
    option("일주일", `${formatDateDots(addDays(today, 6))}까지`, addDays(today, 6)),
    option("기한 없이", "내정보에서 다시 시작", null),
    h("button", { class: "sheet-close", dataset: { action: "closeSheet" } }, "닫기"),
  ], { title: `${habit.emoji} ${habit.name} 쉬어가기`, sub: "쉬는 동안은 예정에서 빠지고 스트릭도 끊기지 않아요." });
}

function recordSheet(state, id) {
  const habit = state.data.habits[id];
  if (!habit) return null;
  const today = todayKey();
  const { checks, settings } = state.data;
  const month = state.ui.recordMonth;
  const stats = monthlyStats({ [id]: habit }, checks, month, today);
  const row = stats.perHabit[0];
  const streak = habitStreak(habit, checks, today);
  return sheet([
    h("div", { class: "card-row" },
      h("button", { class: "arrow", dataset: { action: "moveRecordMonth", n: "-1" }, "aria-label": "지난달" }, "‹"),
      h("span", { class: "card-title" }, `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`),
      h("button", { class: `arrow${month === today.slice(0, 7) ? " dim" : ""}`, dataset: { action: "moveRecordMonth", n: "1" }, disabled: month === today.slice(0, 7), "aria-label": "다음달" }, "›"),
    ),
    row ? h("div", { class: "habit-card single" },
      h("div", { class: "day-grid" }, stats.days.map((day) => h("div", { class: `day-cell ${row.cells[day]}` }, String(Number(day.slice(8)))))),
      h("div", { class: "hc-foot" }, h("span", null, `🕓 ${row.pct == null ? "–" : row.pct + "%"}`), h("span", null, `✔ ${row.done}`), h("span", null, `🔥 ${streak}`)),
    ) : h("div", { class: "empty-state" }, h("p", { class: "main" }, "이 달엔 예정일이 없어요")),
    h("button", { class: "sheet-close", dataset: { action: "closeSheet" } }, "닫기"),
  ], { title: `${habit.emoji} ${habit.name}`, sub: "월간 기록" });
}

export function renderSheet(state, drafts) {
  const s = state.ui.sheet;
  if (!s) return null;
  switch (s.type) {
    case "habitActions": return habitActions(state, s.id);
    case "todoActions": return todoActions(state, s.id);
    case "schedule": return scheduleSheet(state, drafts);
    case "emoji": return sheet([emojiGrid(state.ui.page?.values.emoji)], { title: "이모지 선택" });
    case "quadrant": return quadrantPicker(state, s.id);
    case "tagActions": return tagActions(state, s.id);
    case "tagManage": return tagManageSheet(state);
    case "confirmDeleteTag": {
      const name = state.data.goalTags[s.id]?.name ?? "";
      return confirmBox([`"${name}" 목표를 삭제할까요?`, h("br"), "습관은 남고 이 태그만 사라져요."], "삭제", { action: "deleteTag", id: s.id });
    }
    case "fab": return fabMenu(state);
    case "ended": return endedSheet(state);
    case "pause": return pauseSheet(state, s.id);
    case "record": return recordSheet(state, s.id);
    case "confirmEndHabit": {
      const name = state.data.habits[s.id]?.name ?? "";
      return confirmBox([`"${name}" 루틴을 오늘부터 끝낼까요?`, h("br"), "기록은 남고, 내정보 → 끝낸 루틴에서 다시 시작할 수 있어요."], "끝내기", { action: "endHabit", id: s.id }, { danger: false });
    }
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

import { EMOJI_OPTIONS } from "../config.js";
import { h } from "../utils/dom.js";
import { ISO_DAYS_KR, formatDateDots } from "../utils/date.js";
import { REPEAT_PRESETS, TRIGGER_SUGGESTIONS, repeatLabel } from "../domain/format.js";
import { page, chip } from "./parts.js";

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 7];

/** 반복 요일 편집: 프리셋 칩 + 요일 토글. values.repeatDays를 읽고 form 액션으로 바꾼다. */
export function repeatEditor(values) {
  const days = values.repeatDays;
  const presetOn = (p) => p.days.length === days.length && p.days.every((d) => days.includes(d));
  return h("div", { class: "form-section" },
    h("div", { class: "k" }, "반복", h("span", { class: "hint" }, repeatLabel(days, { long: true }))),
    h("div", { class: "chips", style: { marginBottom: "10px" } }, REPEAT_PRESETS.map((p) =>
      chip(p.label, { on: presetOn(p), small: true, dataset: { action: "formRepeatPreset", preset: p.id } }))),
    h("div", { class: "day-chips" }, DAY_ORDER.map((d) =>
      h("button", { class: `day-chip${days.includes(d) ? " on" : ""}`, dataset: { action: "formToggleDay", day: String(d) } }, ISO_DAYS_KR[d]))),
    days.length === 0 ? h("div", { class: "form-error" }, "요일을 하나 이상 선택해 주세요") : null,
  );
}

/** 시간/상황 트리거 편집 */
export function triggerEditor(values, drafts) {
  const type = values.triggerType;
  const seg = (id, label) => h("button", { class: type === id ? "on" : "", dataset: { action: "formTriggerType", triggerType: id } }, label);
  let body = null;
  if (type === "time") {
    body = h("input", { class: "time-input", type: "time", value: values.triggerTime, dataset: { action: "formTriggerTime" } });
  } else if (type === "context") {
    body = h("div", null,
      h("input", { class: "text-input", id: "triggerTextField", value: drafts.triggerText, placeholder: "예) 출근길, 자기 전", maxlength: "12", dataset: { draft: "triggerText" } }),
      h("div", { class: "chips", style: { marginTop: "8px" } }, TRIGGER_SUGGESTIONS.map((s) =>
        chip(s, { small: true, on: drafts.triggerText === s, dataset: { action: "formTriggerSuggest", text: s } }))),
    );
  }
  return h("div", { class: "form-section" },
    h("div", { class: "k" }, "시간"),
    h("div", { class: "seg2" }, seg("none", "지정 안 함"), seg("time", "시간"), seg("context", "상황")),
    body,
  );
}

function dateRow(label, field, value, { clearable = false } = {}) {
  return h("div", { class: "form-row" },
    h("span", { class: "k" }, label),
    h("span", { class: "v" },
      h("input", { type: "date", value, dataset: { action: "formDate", field }, "aria-label": label }),
      clearable && value ? h("button", { class: "clear", dataset: { action: "formClearDate", field } }, "지우기") : null,
    ),
  );
}

/** 빠른 설정 시트와 폼 페이지가 함께 쓰는 일정 편집 묶음 */
export function scheduleEditor(values, drafts) {
  return h("div", { class: "form-group" },
    dateRow("시작 날짜", "startDate", values.startDate),
    dateRow("종료 날짜", "endDate", values.endDate, { clearable: true }),
    repeatEditor(values),
    triggerEditor(values, drafts),
  );
}

export function isHabitFormValid(values, drafts) {
  return drafts.habitName.trim().length > 0 && values.repeatDays.length > 0
    && (!values.endDate || values.endDate >= values.startDate)
    && (values.triggerType !== "time" || !!values.triggerTime);
}

export function renderHabitForm(state, drafts) {
  const values = state.ui.page.values;
  const editing = !!values.id;
  const ready = isHabitFormValid(values, drafts);
  return page(editing ? "루틴 수정" : "루틴", { confirmLabel: "확인", confirmDataset: { action: "submitHabitForm" }, confirmReady: ready },
    h("div", { class: "form-name" },
      h("button", { class: "emoji-btn", dataset: { action: "openEmojiSheet" } }, values.emoji),
      h("input", { id: "habitNameField", value: drafts.habitName, placeholder: "루틴 입력", maxlength: "30", dataset: { draft: "habitName" } }),
    ),
    scheduleEditor(values, drafts),
    editing ? h("button", { class: "btn danger-ghost block big", dataset: { action: "askDeleteHabit", id: values.id } }, "삭제") : null,
    h("div", { class: "version" }, `${formatDateDots(values.startDate)}부터 ${values.endDate ? formatDateDots(values.endDate) + "까지" : "계속"}`),
  );
}

export function emojiGrid(current) {
  return h("div", { class: "emoji-grid" }, EMOJI_OPTIONS.map((e) =>
    h("button", { class: `emoji-option${current === e ? " selected" : ""}`, dataset: { action: "formEmoji", emoji: e } }, e)));
}

/** 투두 폼(바텀시트 본문) */
export function todoFormBody(values, drafts) {
  const editing = !!values.id;
  return [
    h("input", { class: "text-input", id: "todoTitleField", value: drafts.todoTitle, placeholder: "할 일", maxlength: "60", dataset: { draft: "todoTitle", enter: "submitTodoForm" } }),
    h("div", { class: "form-group", style: { marginTop: "12px" } },
      h("div", { class: "form-row" },
        h("span", { class: "k" }, "🕒 시간"),
        h("span", { class: "v" },
          h("input", { type: "time", value: values.time, dataset: { action: "formTodoTime" } }),
          values.time ? h("button", { class: "clear", dataset: { action: "formTodoTimeClear" } }, "지우기") : null,
        ),
      ),
      h("div", { class: "form-row" },
        h("span", { class: "k" }, "📅 날짜"),
        h("span", { class: "v" }, h("input", { type: "date", value: values.date, dataset: { action: "formTodoDate" } })),
      ),
    ),
    h("div", { class: "btn-row" },
      editing ? h("button", { class: "btn danger-ghost", dataset: { action: "askDeleteTodo", id: values.id } }, "삭제") : null,
      h("button", { class: "btn primary", dataset: { action: "submitTodoForm" } }, editing ? "저장하기" : "추가하기"),
    ),
  ];
}

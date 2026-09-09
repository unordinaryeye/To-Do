import { EMOJI_OPTIONS, TAG_COLORS } from "../config.js";
import { activeTags } from "../state/selectors.js";
import { h } from "../utils/dom.js";
import { ISO_DAYS_KR, isValidDateKey, isValidTime, compareKeys } from "../utils/date.js";
import { REPEAT_PRESETS, TRIGGER_SUGGESTIONS, TIME_PRESETS, repeatLabel } from "../domain/format.js";
import { page, chip } from "./parts.js";

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 7];

/**
 * 폼의 텍스트·날짜·시간 입력은 drafts(비제어)에 두고 확인 시점에 읽는다.
 * iOS의 date/time 피커는 값이 바뀔 때마다 change를 쏘므로 그때마다 재렌더하면 피커가 닫힌다.
 * 재렌더가 필요한 값(이모지, 반복 요일, 트리거 종류)만 values에 둔다.
 */
export function initHabitDrafts(drafts, values) {
  Object.assign(drafts, {
    habitName: values.name, triggerText: values.triggerText, triggerTime: values.triggerTime,
    startDate: values.startDate, endDate: values.endDate,
  });
}

export function initTodoDrafts(drafts, values) {
  Object.assign(drafts, { todoTitle: values.title, todoTime: values.time, todoDate: values.date });
}

/** 유효성 검사. 문제가 없으면 null, 있으면 사용자에게 보여줄 메시지. */
export function habitFormError(values, drafts, today, { requireName = true } = {}) {
  if (requireName && !drafts.habitName.trim()) return "루틴 이름을 입력해 주세요";
  if (!values.repeatDays.length) return "요일을 하나 이상 선택해 주세요";
  if (!isValidDateKey(drafts.startDate)) return "시작 날짜를 확인해 주세요";
  if (drafts.endDate) {
    if (!isValidDateKey(drafts.endDate)) return "종료 날짜를 확인해 주세요";
    if (compareKeys(drafts.endDate, drafts.startDate) < 0) return "종료 날짜는 시작 날짜 이후여야 해요";
    const changed = drafts.endDate !== values.originalEndDate;
    if (changed && compareKeys(drafts.endDate, today) < 0) return "종료 날짜는 오늘 이후로 정해 주세요";
  }
  if (values.triggerType === "time" && !isValidTime(drafts.triggerTime)) return "시간을 입력해 주세요";
  if (values.triggerType === "context" && !drafts.triggerText.trim()) return "상황을 입력해 주세요";
  return null;
}

export function repeatEditor(values) {
  const days = values.repeatDays;
  const presetOn = (p) => p.days.length === days.length && p.days.every((d) => days.includes(d));
  return h("div", { class: "form-section" },
    h("div", { class: "k" }, "반복", h("span", { class: "hint" }, repeatLabel(days, { long: true }))),
    h("div", { class: "chips", style: { marginBottom: "10px" } }, REPEAT_PRESETS.map((p) =>
      chip(p.label, { on: presetOn(p), small: true, dataset: { action: "formRepeatPreset", preset: p.id } }))),
    h("div", { class: "day-chips" }, DAY_ORDER.map((d) =>
      h("button", { class: `day-chip${days.includes(d) ? " on" : ""}`, dataset: { action: "formToggleDay", day: String(d) }, "aria-pressed": String(days.includes(d)) }, ISO_DAYS_KR[d]))),
    days.length === 0 ? h("div", { class: "form-error" }, "요일을 하나 이상 선택해 주세요") : null,
  );
}

export function triggerEditor(values, drafts) {
  const type = values.triggerType;
  const seg = (id, label) => h("button", { class: type === id ? "on" : "", dataset: { action: "formTriggerType", triggerType: id } }, label);
  let body = null;
  if (type === "time") {
    body = h("div", null,
      h("input", { class: "time-input", id: "triggerTimeField", type: "time", value: drafts.triggerTime, dataset: { draft: "triggerTime" }, "aria-label": "시간" }),
      h("div", { class: "chips", style: { marginTop: "8px" } }, TIME_PRESETS.map((p) =>
        chip(`${p.label} ${p.time}`, { small: true, on: drafts.triggerTime === p.time, dataset: { action: "formTimePreset", time: p.time } }))),
    );
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
    type === "none" ? h("div", { class: "chips" }, TIME_PRESETS.map((p) =>
      chip(`${p.label} ${p.time}`, { small: true, dataset: { action: "formTimePreset", time: p.time } }))) : null,
    body,
  );
}

function dateRow(label, draftName, value, { clearable = false } = {}) {
  return h("div", { class: "form-row" },
    h("span", { class: "k" }, label),
    h("span", { class: "v" },
      h("input", { type: "date", id: `${draftName}Field`, value, dataset: { draft: draftName }, "aria-label": label }),
      clearable && value ? h("button", { class: "clear", dataset: { action: "formClearDate", draft: draftName } }, "지우기") : null,
    ),
  );
}

/** 빠른 설정 시트와 폼 페이지가 함께 쓰는 일정 편집 묶음 */
export function scheduleEditor(values, drafts) {
  return h("div", { class: "form-group" },
    dateRow("시작 날짜", "startDate", drafts.startDate),
    dateRow("종료 날짜", "endDate", drafts.endDate, { clearable: true }),
    repeatEditor(values),
    triggerEditor(values, drafts),
  );
}

export function renderHabitForm(state, drafts) {
  const values = state.ui.page.values;
  const editing = !!values.id;
  return page(editing ? "루틴 수정" : "루틴", { confirmLabel: "확인", confirmDataset: { action: "submitHabitForm" } },
    h("div", { class: "form-name" },
      h("button", { class: "emoji-btn", dataset: { action: "openEmojiSheet" }, "aria-label": "이모지 선택" }, values.emoji),
      h("input", { id: "habitNameField", value: drafts.habitName, placeholder: "루틴 입력", maxlength: "30", dataset: { draft: "habitName" }, "aria-label": "루틴 이름" }),
    ),
    scheduleEditor(values, drafts),
    tagSection(state, values),
    editing ? h("button", { class: "btn danger-ghost block big", dataset: { action: "askDeleteHabit", id: values.id } }, "삭제") : null,
  );
}

function tagSection(state, values) {
  const tags = activeTags(state.data);
  return h("div", { class: "form-group" },
    h("div", { class: "form-row" },
      h("span", { class: "k" }, "투두 탭에도 표시"),
      h("button", { class: `switch${values.showInTodo ? " on" : ""}`, dataset: { action: "formToggleShowInTodo" }, role: "switch", "aria-checked": String(!!values.showInTodo) }, h("span", { class: "knob" })),
    ),
    h("div", { class: "form-section" },
      h("div", { class: "k" }, "🏷 목표 태그", h("span", { class: "hint" }, values.goalTagIds.length ? `${values.goalTagIds.length}개 선택` : "선택 안 함")),
      h("div", { class: "chips" },
        tags.map((tag) => chip(`${tag.emoji} ${tag.name}`, { on: values.goalTagIds.includes(tag.id), small: true, dataset: { action: "formToggleTag", id: tag.id } })),
        chip("+ 새 목표", { small: true, dataset: { action: "openTagForm", from: "habit" } }),
      ),
    ),
  );
}

export function initTagDrafts(drafts, values) {
  drafts.tagName = values.name;
}

export function renderTagForm(state, drafts) {
  const values = state.ui.page.values;
  const editing = !!values.id;
  return page(editing ? "목표 수정" : "목표 추가", { confirmLabel: "확인", confirmDataset: { action: "submitTagForm" }, backDataset: { action: "backFromTagForm" } },
    h("div", { class: "form-name" },
      h("button", { class: "emoji-btn", dataset: { action: "openEmojiSheet" }, "aria-label": "이모지 선택" }, values.emoji),
      h("input", { id: "tagNameField", value: drafts.tagName, placeholder: "목표 이름 (예: 건강 챙기기)", maxlength: "20", dataset: { draft: "tagName" }, "aria-label": "목표 이름" }),
    ),
    h("div", { class: "form-group" },
      h("div", { class: "form-section" },
        h("div", { class: "k" }, "색상"),
        h("div", { class: "color-row" }, TAG_COLORS.map((c) =>
          h("button", { class: `color-dot${values.color === c ? " on" : ""}`, style: { background: c }, dataset: { action: "formColor", color: c }, "aria-label": c }))),
      ),
    ),
    editing ? h("button", { class: "btn danger-ghost block big", dataset: { action: "askDeleteTag", id: values.id } }, "삭제") : null,
  );
}

export function emojiGrid(current) {
  return h("div", { class: "emoji-grid" }, EMOJI_OPTIONS.map((e) =>
    h("button", { class: `emoji-option${current === e ? " selected" : ""}`, dataset: { action: "formEmoji", emoji: e }, "aria-label": e }, e)));
}

/** 투두 폼. 키보드가 바텀시트를 가리는 iOS 문제를 피해 전체 화면 페이지로 연다. */
export function renderTodoForm(state, drafts) {
  const values = state.ui.page.values;
  const editing = !!values.id;
  return page(editing ? "할 일 수정" : "할 일 추가", { confirmLabel: editing ? "저장" : "추가", confirmDataset: { action: "submitTodoForm" } },
    h("div", { class: "form-name" },
      h("span", { style: { fontSize: "22px" } }, "📌"),
      h("input", { id: "todoTitleField", value: drafts.todoTitle, placeholder: "할 일 입력", maxlength: "60", dataset: { draft: "todoTitle", enter: "submitTodoForm" }, "aria-label": "할 일" }),
    ),
    h("div", { class: "form-group" },
      h("div", { class: "form-row" },
        h("span", { class: "k" }, "🕒 시간"),
        h("span", { class: "v" },
          h("input", { type: "time", id: "todoTimeField", value: drafts.todoTime, dataset: { draft: "todoTime" }, "aria-label": "시간" }),
          drafts.todoTime ? h("button", { class: "clear", dataset: { action: "formClearDate", draft: "todoTime" } }, "지우기") : null,
        ),
      ),
      h("div", { class: "form-row" },
        h("span", { class: "k" }, "📅 날짜"),
        h("span", { class: "v" }, h("input", { type: "date", id: "todoDateField", value: drafts.todoDate, dataset: { draft: "todoDate" }, "aria-label": "날짜" })),
      ),
      h("div", { class: "form-section" },
        h("div", { class: "k" }, "🎯 우선순위", h("span", { class: "hint" }, values.classified ? "매트릭스에 배치됨" : "미분류")),
        h("div", { class: "chips" },
          chip("🔥 긴급", { on: values.classified && values.urgent, dataset: { action: "formPriority", flag: "urgent" } }),
          chip("⭐ 중요", { on: values.classified && values.important, dataset: { action: "formPriority", flag: "important" } }),
          values.classified ? chip("분류 해제", { small: true, dataset: { action: "formPriorityClear" } }) : null,
        ),
      ),
    ),
    editing ? h("button", { class: "btn danger-ghost block big", dataset: { action: "askDeleteTodo", id: values.id } }, "삭제") : null,
  );
}

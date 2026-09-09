import { addDays, addMonths, todayKey, isValidDateKey, isValidTime } from "../utils/date.js";
import { A } from "../state/reducers.js";
import { randomCode } from "../utils/id.js";
import { focusById } from "../utils/dom.js";
import { setSyncCode, setLastBackup, clearLastBackup } from "../storage/local.js";
import { downloadBackup } from "../storage/backup.js";
import { defaultData } from "../domain/migrate.js";
import { REPEAT_PRESETS } from "../domain/format.js";
import { habitFormValues, todoFormValues } from "../state/selectors.js";
import { isHabitFormValid } from "./forms.js";
import { toast } from "./toast.js";

/** data-action 이름 → 핸들러(el, event). drafts는 입력 중인 텍스트. */
export function createActions({ store, sync, drafts }) {
  const { dispatch, getState } = store;
  const ui = (patch) => dispatch({ type: A.UI_SET, patch });
  const selected = () => getState().ui.selectedDate;
  const closeAll = () => ui({ sheet: null, page: null });

  const navigation = {
    goRoute: (el) => ui({ route: el.dataset.route, sheet: null, page: null }),
    syncRoute: (route) => { if (getState().ui.route !== route) ui({ route, sheet: null, page: null }); },
    openSettingsRoute: () => ui({ route: "settings" }),
    setHomeTab: (el) => ui({ homeTab: el.dataset.tab }),
    moveDate: (el) => ui({ selectedDate: addDays(selected(), Number(el.dataset.n)) }),
    goToday: () => ui({ selectedDate: todayKey() }),
    selectDate: (el) => ui({ selectedDate: el.dataset.date }),
    moveStatsMonth: (el) => ui({ statsMonth: addMonths(getState().ui.statsMonth, Number(el.dataset.n)) }),
    toggleFilterTag: (el) => ui({ filterTagId: getState().ui.filterTagId === el.dataset.id ? null : el.dataset.id }),
    closeSheet: (el, event) => {
      const isBackdrop = el.classList.contains("overlay") || el.classList.contains("fab-menu");
      if (isBackdrop && event && event.target !== el) return; // 시트 본문 탭은 무시
      ui({ sheet: null });
    },
    closePage: () => ui({ page: null, sheet: null }),
    openFab: () => ui({ sheet: { type: "fab" } }),
  };

  // ── 폼 값 편집. 시트(빠른 설정)가 열려 있으면 시트 값을, 아니면 페이지 값을 고친다 ──
  function formValues() {
    const { sheet, page } = getState().ui;
    return sheet?.values ? sheet.values : page?.values;
  }
  function patchForm(patch) {
    const { sheet, page } = getState().ui;
    if (sheet?.values) ui({ sheet: { ...sheet, values: { ...sheet.values, ...patch } } });
    else if (page?.values) ui({ page: { ...page, values: { ...page.values, ...patch } } });
  }

  const form = {
    formRepeatPreset: (el) => {
      const preset = REPEAT_PRESETS.find((p) => p.id === el.dataset.preset);
      if (preset) patchForm({ repeatDays: [...preset.days] });
    },
    formToggleDay: (el) => {
      const day = Number(el.dataset.day);
      const days = formValues().repeatDays;
      patchForm({ repeatDays: days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort() });
    },
    formTriggerType: (el) => patchForm({ triggerType: el.dataset.triggerType }),
    formTriggerTime: (el) => patchForm({ triggerTime: isValidTime(el.value) ? el.value : "" }),
    formTriggerSuggest: (el) => {
      drafts.triggerText = el.dataset.text;
      patchForm({}); // 재렌더로 칩 선택 상태 반영
      focusById("triggerTextField");
    },
    formDate: (el) => { if (isValidDateKey(el.value)) patchForm({ [el.dataset.field]: el.value }); },
    formClearDate: (el) => patchForm({ [el.dataset.field]: "" }),
    openEmojiSheet: () => ui({ sheet: { type: "emoji" } }),
    formEmoji: (el) => { patchForm({ emoji: el.dataset.emoji }); ui({ sheet: null }); },
  };

  function triggerFromForm(values) {
    if (values.triggerType === "time") return { type: "time", value: values.triggerTime };
    if (values.triggerType === "context") return drafts.triggerText.trim() ? { type: "context", value: drafts.triggerText.trim() } : null;
    return null;
  }

  const habits = {
    toggleCheck: (el) => dispatch({ type: A.CHECK_TOGGLE, date: selected(), habitId: el.dataset.id }),
    openHabitActions: (el) => ui({ sheet: { type: "habitActions", id: el.dataset.id } }),
    openHabitForm: (el) => {
      const values = habitFormValues(getState().data, el?.dataset.id || null, todayKey());
      drafts.habitName = values.name;
      drafts.triggerText = values.triggerText;
      ui({ sheet: null, page: { type: "habitForm", values } });
      if (!values.id) focusById("habitNameField");
    },
    openSchedule: (el) => {
      const values = habitFormValues(getState().data, el.dataset.id, todayKey());
      drafts.triggerText = values.triggerText;
      ui({ sheet: { type: "schedule", values } });
    },
    submitHabitForm: () => {
      const values = getState().ui.page?.values;
      if (!values || !isHabitFormValid(values, drafts)) { toast("⚠️", "이름과 반복 요일을 확인해 주세요"); return; }
      dispatch({
        type: A.HABIT_UPSERT, id: values.id, name: drafts.habitName.trim(), emoji: values.emoji,
        startDate: values.startDate, endDate: values.endDate || null,
        repeatDays: values.repeatDays, trigger: triggerFromForm(values), today: todayKey(),
      });
      closeAll();
      toast("✅", values.id ? "루틴을 저장했어요" : "루틴을 시작했어요");
    },
    submitSchedule: () => {
      const values = getState().ui.sheet?.values;
      const habit = values && getState().data.habits[values.id];
      if (!habit || !values.repeatDays.length) return;
      dispatch({
        type: A.HABIT_UPSERT, id: values.id, name: habit.name, emoji: habit.emoji,
        startDate: values.startDate, endDate: values.endDate || null,
        repeatDays: values.repeatDays, trigger: triggerFromForm(values), today: todayKey(),
      });
      ui({ sheet: null });
      toast("✅", "오늘부터 적용돼요");
    },
    moveHabit: (el) => dispatch({ type: A.HABIT_MOVE, id: el.dataset.id, dir: Number(el.dataset.dir) }),
    askDeleteHabit: (el) => ui({ sheet: { type: "confirmDeleteHabit", id: el.dataset.id } }),
    deleteHabit: (el) => { dispatch({ type: A.HABIT_DELETE, id: el.dataset.id }); closeAll(); toast("🗑", "루틴을 삭제했어요"); },
  };

  const todos = {
    toggleTodo: (el) => dispatch({ type: A.TODO_TOGGLE, id: el.dataset.id }),
    openTodoActions: (el) => ui({ sheet: { type: "todoActions", id: el.dataset.id } }),
    openTodoForm: (el) => {
      const values = todoFormValues(getState().data, el?.dataset.id || null, selected());
      drafts.todoTitle = values.title;
      ui({ sheet: { type: "todoForm", values } });
      focusById("todoTitleField");
    },
    formTodoTime: (el) => patchForm({ time: isValidTime(el.value) ? el.value : "" }),
    formTodoTimeClear: () => patchForm({ time: "" }),
    formTodoDate: (el) => { if (isValidDateKey(el.value)) patchForm({ date: el.value }); },
    submitTodoForm: () => {
      const values = getState().ui.sheet?.values;
      const title = drafts.todoTitle.trim();
      if (!values || !title) { toast("⚠️", "할 일을 입력해 주세요"); return; }
      dispatch({ type: A.TODO_UPSERT, id: values.id, title, date: values.date, time: values.time || null });
      drafts.todoTitle = "";
      ui({ sheet: null, selectedDate: values.date, homeTab: "todos" });
    },
    quickAddTodo: () => {
      const title = drafts.todo.trim();
      if (!title) return;
      drafts.todo = "";
      dispatch({ type: A.TODO_UPSERT, id: null, title, date: selected(), time: null });
      focusById("todoInputField");
    },
    moveTodo: (el) => dispatch({ type: A.TODO_MOVE, id: el.dataset.id, dir: Number(el.dataset.dir) }),
    askDeleteTodo: (el) => ui({ sheet: { type: "confirmDeleteTodo", id: el.dataset.id } }),
    deleteTodo: (el) => { dispatch({ type: A.TODO_DELETE, id: el.dataset.id }); ui({ sheet: null }); },
  };

  const data = {
    setWeekStart: (el) => dispatch({ type: A.SETTINGS_SET, patch: { weekStart: Number(el.value) } }),
    backup: () => { downloadBackup(getState().data); setLastBackup(); toast("✅", "백업 파일이 저장되었어요"); },
    restore: () => document.getElementById("restoreInput").click(),
    askReset: () => ui({ sheet: { type: "confirmReset" } }),
    reset: () => {
      dispatch({ type: A.DATA_REPLACE, data: defaultData(todayKey()) });
      clearLastBackup();
      ui({ sheet: null });
      toast("🔄", "초기화 완료");
    },
  };

  const syncActions = {
    createSync: async () => {
      if (!sync.ready) { toast("⚠️", "Firebase가 설정되지 않았어요"); return; }
      const code = randomCode();
      try {
        await sync.create(code, getState().data);
        setSyncCode(code);
        ui({ syncCode: code, syncConnected: true });
        toast("✅", "동기화 코드가 생성되었어요");
      } catch (error) {
        console.error("동기화 생성 실패:", error);
        toast("❌", error.code === "permission-denied" ? "동기화 권한 오류 (Firestore 규칙)" : "동기화 생성에 실패했어요");
      }
    },
    joinSync: async () => {
      const code = drafts.sync.trim().toUpperCase();
      if (code.length !== 6) { toast("⚠️", "6자리 코드를 입력해주세요"); return; }
      try {
        const remote = await sync.join(code);
        if (!remote) { toast("❌", "존재하지 않는 코드예요"); return; }
        drafts.sync = "";
        dispatch({ type: A.DATA_APPLY_REMOTE, patch: remote });
        setSyncCode(code);
        ui({ syncCode: code, syncConnected: true });
        toast("✅", "동기화 연결 완료!");
      } catch (error) {
        console.error("동기화 연결 실패:", error);
        toast("❌", error.code === "schema-too-new" ? error.message : "연결에 실패했어요. 인터넷을 확인해 주세요");
      }
    },
    stopSync: () => {
      sync.disconnect();
      setSyncCode("");
      ui({ syncCode: "", syncConnected: false });
      toast("🔓", "동기화가 해제되었어요");
    },
  };

  return { ...navigation, ...form, ...habits, ...todos, ...data, ...syncActions };
}

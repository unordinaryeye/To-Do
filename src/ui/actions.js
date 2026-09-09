import { addDays, todayKey } from "../utils/date.js";
import { A } from "../state/reducers.js";
import { randomCode } from "../utils/id.js";
import { focusById } from "../utils/dom.js";
import { setSyncCode, setLastBackup, clearLastBackup } from "../storage/local.js";
import { downloadBackup } from "../storage/backup.js";
import { defaultData } from "../domain/migrate.js";
import { toast } from "./toast.js";

/** data-action 이름 → 핸들러(el, event). drafts는 입력 중인 텍스트. */
export function createActions({ store, sync, drafts }) {
  const { dispatch, getState } = store;
  const ui = (patch) => dispatch({ type: A.UI_SET, patch });
  const selected = () => getState().ui.selectedDate;

  const navigation = {
    setView: (el) => ui({ view: el.dataset.view, editingId: null, editingTodoId: null, showEmojiPicker: false }),
    openSettings: () => ui({ showSettings: true }),
    closeSettings: () => ui({ showSettings: false }),
    closeConfirm: () => ui({ showConfirm: false }),
    closeOverlay: (el, event) => { if (event.target === el) ui({ showSettings: false, showConfirm: false }); },
    moveDate: (el) => ui({ selectedDate: addDays(selected(), Number(el.dataset.n)) }),
    goToday: () => ui({ selectedDate: todayKey() }),
    selectDate: (el) => ui({ selectedDate: el.dataset.date }),
  };

  const habits = {
    toggleCheck: (el) => dispatch({ type: A.CHECK_TOGGLE, date: selected(), habitId: el.dataset.id }),
    moveHabit: (el) => dispatch({ type: A.HABIT_MOVE, id: el.dataset.id, dir: Number(el.dataset.dir) }),
    deleteHabit: (el) => dispatch({ type: A.HABIT_DELETE, id: el.dataset.id }),
    editHabit: (el) => { ui({ editingId: el.dataset.id }); focusById(`edit-${el.dataset.id}`); },
    commitHabitEdit: (el) => {
      const name = el.value.trim();
      if (name) dispatch({ type: A.HABIT_RENAME, id: el.dataset.id, name });
      ui({ editingId: null });
    },
    toggleEmojiPicker: () => ui({ showEmojiPicker: !getState().ui.showEmojiPicker }),
    pickEmoji: (el) => ui({ newEmoji: el.dataset.emoji, showEmojiPicker: false }),
    pickCategory: (el) => ui({ newCategory: el.value }),
    addHabit: () => {
      const name = drafts.newRoutine.trim();
      if (!name) return;
      const { newEmoji, newCategory } = getState().ui;
      drafts.newRoutine = "";
      dispatch({ type: A.HABIT_ADD, name, emoji: newEmoji, category: newCategory, today: todayKey() });
      ui({ showEmojiPicker: false });
      focusById("newRoutineField");
    },
  };

  const todos = {
    toggleTodo: (el) => dispatch({ type: A.TODO_TOGGLE, id: el.dataset.id }),
    deleteTodo: (el) => dispatch({ type: A.TODO_DELETE, id: el.dataset.id }),
    moveTodo: (el) => dispatch({ type: A.TODO_MOVE, id: el.dataset.id, dir: Number(el.dataset.dir) }),
    editTodo: (el) => { ui({ editingTodoId: el.dataset.id }); focusById(`editTodo-${el.dataset.id}`); },
    commitTodoEdit: (el) => {
      const title = el.value.trim();
      if (title) dispatch({ type: A.TODO_RENAME, id: el.dataset.id, title });
      ui({ editingTodoId: null });
    },
    addTodo: () => {
      const title = drafts.todo.trim();
      if (!title) return;
      drafts.todo = "";
      dispatch({ type: A.TODO_ADD, title, date: selected() });
      focusById("todoInputField");
    },
  };

  const data = {
    backup: () => {
      downloadBackup(getState().data);
      setLastBackup();
      ui({ showSettings: false });
      toast("✅", "백업 파일이 저장되었어요");
    },
    restore: () => document.getElementById("restoreInput").click(),
    askReset: () => ui({ showSettings: false, showConfirm: true }),
    reset: () => {
      dispatch({ type: A.DATA_REPLACE, data: defaultData(todayKey()) });
      clearLastBackup();
      ui({ showConfirm: false, showSettings: false });
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

  return { ...navigation, ...habits, ...todos, ...data, ...syncActions };
}

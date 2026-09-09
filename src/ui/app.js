import { h, replaceContent, focusById } from "../utils/dom.js";
import { addDays, todayKey } from "../utils/date.js";
import { A } from "../state/reducers.js";
import { randomCode } from "../utils/id.js";
import { setSyncCode, setLastBackup, clearLastBackup } from "../storage/local.js";
import { downloadBackup, parseBackup, readFileText } from "../storage/backup.js";
import { defaultData } from "../domain/migrate.js";
import { toast } from "./toast.js";
import { renderDateNav, renderDaily } from "./daily.js";
import { renderRoutines } from "./routines.js";
import { renderSettings, renderConfirmReset } from "./settings.js";

/** 입력 중인 텍스트. store 밖에 두어 타이핑마다 재렌더하지 않는다. */
const drafts = { newRoutine: "", todo: "", sync: "" };

function header(ui) {
  const status = ui.syncCode ? (ui.syncConnected ? "online" : "offline") : "none";
  const subtitle = ui.syncCode
    ? h("p", { class: "subtitle" }, h("span", { class: `sync-dot ${status}` }), ` ${ui.syncConnected ? "동기화 연결됨" : "오프라인"}`)
    : h("p", { class: "subtitle" }, "매일의 작은 습관이 큰 변화를 만듭니다");
  const tab = (view, label) => h("button", { class: `tab-btn${ui.view === view ? " active" : ""}`, dataset: { action: "setView", view } }, label);
  return h("div", { class: "header" },
    h("div", { class: "header-top" },
      h("div", null, h("h1", null, "Daily Routine"), subtitle),
      h("div", { class: "header-right" },
        h("div", { class: "tabs" }, tab("daily", "체크리스트"), tab("routines", "루틴 관리")),
        h("button", { class: "settings-btn", dataset: { action: "openSettings" }, "aria-label": "설정" }, "⚙️"),
      ),
    ),
    ui.view === "daily" ? renderDateNav({ ui, data: currentData }) : null,
  );
}

let currentData = null;

export function render(state) {
  currentData = state.data;
  const app = document.getElementById("app");
  const overlay = document.getElementById("overlay-root");
  replaceContent(app, header(state.ui), state.ui.view === "daily" ? renderDaily(state, drafts) : renderRoutines(state, drafts));
  if (state.ui.showSettings) replaceContent(overlay, renderSettings(state, drafts));
  else if (state.ui.showConfirm) replaceContent(overlay, renderConfirmReset());
  else overlay.replaceChildren();
}

// ── 액션 핸들러 ──

export function mountApp({ store, sync }) {
  const { dispatch, getState } = store;
  const ui = (patch) => dispatch({ type: A.UI_SET, patch });
  const selected = () => getState().ui.selectedDate;

  const actions = {
    setView: (el) => ui({ view: el.dataset.view, editingId: null, editingTodoId: null, showEmojiPicker: false }),
    openSettings: () => ui({ showSettings: true }),
    closeSettings: () => ui({ showSettings: false }),
    closeConfirm: () => ui({ showConfirm: false }),
    closeOverlay: (el, event) => { if (event.target === el) ui({ showSettings: false, showConfirm: false }); },
    moveDate: (el) => ui({ selectedDate: addDays(selected(), Number(el.dataset.n)) }),
    goToday: () => ui({ selectedDate: todayKey() }),
    selectDate: (el) => ui({ selectedDate: el.dataset.date }),

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
        toast("❌", "동기화 생성에 실패했어요");
      }
    },
    joinSync: async () => {
      const code = drafts.sync.trim().toUpperCase();
      if (code.length !== 6) { toast("⚠️", "6자리 코드를 입력해주세요"); return; }
      try {
        const remote = await sync.join(code, todayKey());
        if (!remote) { toast("❌", "존재하지 않는 코드예요"); return; }
        drafts.sync = "";
        dispatch({ type: A.DATA_APPLY_REMOTE, patch: remote });
        setSyncCode(code);
        ui({ syncCode: code, syncConnected: true });
        toast("✅", "동기화 연결 완료!");
      } catch (error) {
        console.error("동기화 연결 실패:", error);
        toast("❌", "연결에 실패했어요");
      }
    },
    stopSync: () => {
      sync.disconnect();
      setSyncCode("");
      ui({ syncCode: "", syncConnected: false });
      toast("🔓", "동기화가 해제되었어요");
    },
  };

  function run(el, event) {
    const handler = actions[el.dataset.action];
    if (handler) handler(el, event);
  }

  const root = document.body;
  root.addEventListener("click", (event) => {
    const el = event.target.closest("[data-action]");
    if (!el || el.tagName === "INPUT" || el.tagName === "SELECT") return;
    if (el.classList.contains("disabled")) return;
    run(el, event);
  });
  root.addEventListener("input", (event) => {
    const name = event.target.dataset.draft;
    if (!name) return;
    drafts[name] = name === "sync" ? event.target.value.toUpperCase() : event.target.value;
    if (name === "sync") event.target.value = drafts.sync;
  });
  root.addEventListener("change", (event) => {
    if (event.target.dataset.action === "pickCategory") run(event.target, event);
  });
  // 인라인 편집 입력은 Enter 또는 포커스 이탈 시 한 번만 커밋한다.
  function commitOnce(target, event) {
    if (target.dataset.committed) return;
    target.dataset.committed = "1";
    run(target, event);
  }
  root.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) return;
    const target = event.target;
    if (target.dataset.enter) {
      event.preventDefault();
      const handler = actions[target.dataset.enter];
      if (handler) handler(target, event);
    } else if (target.dataset.action?.startsWith("commit")) {
      event.preventDefault();
      commitOnce(target, event);
    }
  });
  root.addEventListener("focusout", (event) => {
    const target = event.target;
    if (target.dataset?.action?.startsWith("commit")) commitOnce(target, event);
  });

  document.getElementById("restoreInput").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      const { data, warnings } = parseBackup(await readFileText(file), todayKey());
      dispatch({ type: A.DATA_REPLACE, data });
      ui({ showSettings: false });
      toast("✅", warnings.length ? "복원 완료 (일부 항목 제외)" : "데이터가 복원되었어요!");
    } catch (error) {
      console.error("복원 실패:", error);
      toast("❌", error.message || "파일을 읽을 수 없어요");
    }
  });

  render(getState());
}

import { h, replaceContent } from "../utils/dom.js";
import { todayKey } from "../utils/date.js";
import { A } from "../state/reducers.js";
import { parseBackup, readFileText } from "../storage/backup.js";
import { toast } from "./toast.js";
import { createActions } from "./actions.js";
import { renderDateNav, renderDaily } from "./daily.js";
import { renderRoutines } from "./routines.js";
import { renderSettings, renderConfirmReset } from "./settings.js";

/** 입력 중인 텍스트. store 밖에 두어 타이핑마다 재렌더하지 않는다. */
const drafts = { newRoutine: "", todo: "", sync: "" };

function header(state) {
  const { ui } = state;
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
    ui.view === "daily" ? renderDateNav(state) : null,
  );
}

export function render(state) {
  const app = document.getElementById("app");
  const overlay = document.getElementById("overlay-root");
  replaceContent(app, header(state), state.ui.view === "daily" ? renderDaily(state, drafts) : renderRoutines(state, drafts));
  if (state.ui.showSettings) replaceContent(overlay, renderSettings(state, drafts));
  else if (state.ui.showConfirm) replaceContent(overlay, renderConfirmReset());
  else overlay.replaceChildren();
}

/** 열려 있는 인라인 편집 입력을 찾는다(한 번에 하나만 존재). */
const openEditInput = () => document.querySelector('input[data-action^="commit"]');

function bindEvents(actions) {
  const run = (el, event) => actions[el.dataset.action]?.(el, event);

  // 인라인 편집은 Enter, 포커스 이탈, 다른 곳 탭 중 무엇이 먼저 오든 한 번만 커밋한다.
  // iOS Safari는 버튼 탭에서 포커스를 옮기지 않을 수 있어 클릭 시에도 커밋한다.
  function commitOnce(target, event) {
    if (!target || target.dataset.committed) return;
    target.dataset.committed = "1";
    run(target, event);
  }

  document.body.addEventListener("click", (event) => {
    const el = event.target.closest("[data-action]");
    if (!el || el.tagName === "INPUT" || el.tagName === "SELECT") return;
    if (el.classList.contains("disabled")) return;
    const editing = openEditInput();
    if (editing && editing !== el) commitOnce(editing, event);
    run(el, event);
  });
  document.body.addEventListener("input", (event) => {
    const name = event.target.dataset.draft;
    if (!name) return;
    drafts[name] = name === "sync" ? event.target.value.toUpperCase() : event.target.value;
    if (name === "sync") event.target.value = drafts.sync;
  });
  document.body.addEventListener("change", (event) => {
    if (event.target.dataset.action === "pickCategory") run(event.target, event);
  });
  document.body.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) return;
    const target = event.target;
    if (target.dataset.enter) {
      event.preventDefault();
      actions[target.dataset.enter]?.(target, event);
    } else if (target.dataset.action?.startsWith("commit")) {
      event.preventDefault();
      commitOnce(target, event);
    }
  });
  document.body.addEventListener("focusout", (event) => {
    const target = event.target;
    if (target.dataset?.action?.startsWith("commit")) commitOnce(target, event);
  });
}

function bindRestore(store) {
  document.getElementById("restoreInput").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      const { data, warnings } = parseBackup(await readFileText(file), todayKey());
      store.dispatch({ type: A.DATA_REPLACE, data });
      store.dispatch({ type: A.UI_SET, patch: { showSettings: false } });
      toast("✅", warnings.length ? "복원 완료 (일부 항목 제외)" : "데이터가 복원되었어요!");
    } catch (error) {
      console.error("복원 실패:", error);
      toast("❌", error.message || "파일을 읽을 수 없어요");
    }
  });
}

export function mountApp({ store, sync }) {
  bindEvents(createActions({ store, sync, drafts }));
  bindRestore(store);
  render(store.getState());
}

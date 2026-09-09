import { replaceContent } from "../utils/dom.js";
import { todayKey } from "../utils/date.js";
import { A } from "../state/reducers.js";
import { parseBackup, readFileText } from "../storage/backup.js";
import { toast } from "./toast.js";
import { createActions } from "./actions.js";
import { renderHome } from "./home.js";
import { renderStats } from "./stats.js";
import { renderGoals } from "./goals.js";
import { renderSettings } from "./settings.js";
import { renderHabitForm } from "./forms.js";
import { renderSheet } from "./sheets.js";
import { renderTabBar, hashFor, routeFromHash } from "./router.js";

/** 입력 중인 텍스트. store 밖에 두어 타이핑마다 재렌더하지 않는다. */
const drafts = { todo: "", sync: "", habitName: "", triggerText: "", todoTitle: "" };

const SCREENS = { home: renderHome, stats: renderStats, goals: renderGoals, settings: renderSettings };

export function render(state) {
  const { ui } = state;
  const app = document.getElementById("app");
  const overlay = document.getElementById("overlay-root");
  replaceContent(app, SCREENS[ui.route](state, drafts), renderTabBar(ui.route));
  app.hidden = !!ui.page; // 전체 화면 페이지가 열리면 뒤 화면을 숨겨 스크롤/포커스가 새지 않게 한다
  const layers = [];
  if (ui.page?.type === "habitForm") layers.push(renderHabitForm(state, drafts));
  const sheetNode = renderSheet(state, drafts);
  if (sheetNode) layers.push(sheetNode);
  replaceContent(overlay, ...layers);
  const wanted = hashFor(ui.route);
  if (location.hash !== wanted) history.replaceState(null, "", wanted);
}

/** 열려 있는 인라인 편집 입력(한 번에 하나) */
const openEditInput = () => document.querySelector('input[data-action^="commit"]');

function bindEvents(actions) {
  const run = (el, event) => actions[el.dataset.action]?.(el, event);

  function commitOnce(target, event) {
    if (!target || target.dataset.committed) return;
    target.dataset.committed = "1";
    run(target, event);
  }

  document.body.addEventListener("click", (event) => {
    const el = event.target.closest("[data-action]");
    if (!el || el.tagName === "INPUT" || el.tagName === "SELECT") return;
    if (el.classList.contains("disabled") || el.disabled) return;
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
    const target = event.target;
    if ((target.tagName === "SELECT" || target.type === "date" || target.type === "time") && target.dataset.action) run(target, event);
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
  window.addEventListener("hashchange", () => actions.syncRoute(routeFromHash()));
}

function bindRestore(store) {
  document.getElementById("restoreInput").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      const { data, warnings } = parseBackup(await readFileText(file), todayKey());
      store.dispatch({ type: A.DATA_REPLACE, data });
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

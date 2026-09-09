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
import { renderHabitForm, renderTodoForm, renderTagForm } from "./forms.js";
import { renderSheet } from "./sheets.js";
import { renderReorder } from "./reorder.js";
import { renderMandalaPage, renderMandalaFull } from "./mandala.js";
import { renderTabBar, hashFor, routeFromHash } from "./router.js";

/** 입력 중인 값(비제어). store 밖에 두어 타이핑·피커 조작마다 재렌더하지 않는다. */
const drafts = {
  todo: "", sync: "",
  habitName: "", triggerText: "", triggerTime: "", startDate: "", endDate: "",
  todoTitle: "", todoTime: "", todoDate: "", tagName: "", mandalaText: "",
};

const SCREENS = { home: renderHome, stats: renderStats, goals: renderGoals, settings: renderSettings };
const PAGES = { habitForm: renderHabitForm, todoForm: renderTodoForm, tagForm: renderTagForm, reorder: renderReorder, mandala: renderMandalaPage, mandalaFull: renderMandalaFull };
const IME_KEYCODE = 229;

let layerWasOpen = false;
let actionsRef = null;
let savedScrollY = 0;

/** 시트/페이지를 history 항목으로 다뤄 iOS 뒤로가기 제스처가 앱을 빠져나가지 않게 한다. */
function syncHistory(layerOpen) {
  if (layerOpen && !layerWasOpen) {
    savedScrollY = window.scrollY;
    history.pushState({ layer: true }, "", location.href);
  } else if (!layerOpen && layerWasOpen) {
    if (history.state?.layer) history.back();
    requestAnimationFrame(() => window.scrollTo(0, savedScrollY));
  }
  layerWasOpen = layerOpen;
}

export function render(state) {
  const { ui } = state;
  const app = document.getElementById("app");
  const overlay = document.getElementById("overlay-root");
  replaceContent(app, SCREENS[ui.route](state, drafts), renderTabBar(ui.route));
  app.hidden = !!ui.page; // 전체 화면 페이지가 열리면 뒤 화면을 숨겨 스크롤/포커스가 새지 않게 한다
  const layers = [];
  if (ui.page && PAGES[ui.page.type]) layers.push(PAGES[ui.page.type](state, drafts, actionsRef));
  const sheetNode = renderSheet(state, drafts);
  if (sheetNode) layers.push(sheetNode);
  replaceContent(overlay, ...layers);
  syncHistory(layers.length > 0);
  const wanted = hashFor(ui.route);
  if (!layerWasOpen && location.hash !== wanted) history.replaceState(null, "", wanted);
}

function bindEvents(actions) {
  const run = (el, event) => actions[el.dataset.action]?.(el, event);

  document.body.addEventListener("click", (event) => {
    const el = event.target.closest("[data-action]");
    if (!el || el.tagName === "INPUT" || el.tagName === "SELECT") return;
    if (el.classList.contains("disabled") || el.disabled) return;
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
    if (target.dataset.draft) drafts[target.dataset.draft] = target.value; // date/time 피커는 change로만 값을 준다
    else if (target.dataset.action && (target.tagName === "SELECT" || target.type === "date")) run(target, event);
  });
  document.body.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing || event.keyCode === IME_KEYCODE) return;
    const target = event.target;
    if (target.dataset.enter) {
      event.preventDefault();
      actions[target.dataset.enter]?.(target, event);
    }
  });
  window.addEventListener("hashchange", () => actions.syncRoute(routeFromHash()));
  window.addEventListener("popstate", (event) => { if (!event.state?.layer) actions.closeLayers(); });

  // iOS: 키보드가 올라오면 fixed 바텀시트가 가려지므로 visualViewport 높이 차이만큼 밀어 올린다.
  const vv = window.visualViewport;
  if (vv) {
    const update = () => document.documentElement.style.setProperty("--kb", `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`);
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
  }
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
  actionsRef = createActions({ store, sync, drafts });
  bindEvents(actionsRef);
  bindRestore(store);
  render(store.getState());
}

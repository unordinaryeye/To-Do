import { FIREBASE_CONFIG } from "./config.js";
import { todayKey } from "./utils/date.js";
import { createStore } from "./state/store.js";
import { rootReducer, initialUi, A } from "./state/reducers.js";
import { loadData, saveData, getSyncCode } from "./storage/local.js";
import { createSync } from "./sync/firestore.js";
import { mountApp, render } from "./ui/app.js";
import { applyTheme } from "./ui/actions.js";
import { startReminders } from "./ui/reminders.js";
import { toast } from "./ui/toast.js";
import { routeFromHash } from "./ui/router.js";

const today = todayKey();
const { data, migrated, warnings } = loadData(today);
warnings.forEach((w) => console.warn("마이그레이션 경고:", w));

let store = null;

const sync = createSync({
  firebase: window.firebase,
  config: FIREBASE_CONFIG,
  todayKey,
  getData: () => store.getState().data,
  applyRemote: (patch) => store.dispatch({ type: A.DATA_APPLY_REMOTE, patch }),
  onStatus: (connected) => store.dispatch({ type: A.UI_SET, patch: { syncConnected: connected } }),
});

const syncCode = getSyncCode();
store = createStore(rootReducer, {
  data,
  ui: initialUi({ today, syncCode, firebaseReady: sync.ready, route: routeFromHash() }),
});

store.subscribe((state, prev, action) => {
  if (state.data !== prev.data) {
    saveData(state.data);
    if (action.type !== A.DATA_APPLY_REMOTE) sync.notifyChange();
  }
  render(state);
});

applyTheme(data.settings.theme);
mountApp({ store, sync });
startReminders(() => store.getState());

// 앱 셸 캐시. 새 버전이 준비되면 알려주고, 사용자가 원할 때 새로고침하게 둔다.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").then((reg) => {
    reg.addEventListener("updatefound", () => {
      const worker = reg.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) toast("⬆️", "새 버전이 있어요. 앱을 다시 열면 적용돼요");
      });
    });
  }).catch((error) => console.warn("서비스 워커 등록 실패:", error));
}
if (migrated) toast("✨", "데이터를 새 형식으로 옮겼어요");
if (syncCode && sync.ready) sync.resume(syncCode);

window.addEventListener("error", (event) => console.error("앱 오류:", event.error || event.message));

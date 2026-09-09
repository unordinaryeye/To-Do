import { FIREBASE_CONFIG } from "./config.js";
import { todayKey } from "./utils/date.js";
import { createStore } from "./state/store.js";
import { rootReducer, initialUi, A } from "./state/reducers.js";
import { loadData, saveData, getSyncCode, setSyncCode } from "./storage/local.js";
import { createSync } from "./sync/firestore.js";
import { mountApp, render } from "./ui/app.js";
import { toast } from "./ui/toast.js";

const today = todayKey();
const { data, migrated, warnings } = loadData(today);
warnings.forEach((w) => console.warn("마이그레이션 경고:", w));

let store = null;

const sync = createSync({
  firebase: window.firebase,
  config: FIREBASE_CONFIG,
  getData: () => store.getState().data,
  applyRemote: (patch) => store.dispatch({ type: A.DATA_APPLY_REMOTE, patch }),
  onStatus: (connected) => store.dispatch({ type: A.UI_SET, patch: { syncConnected: connected } }),
});

const syncCode = getSyncCode();
store = createStore(rootReducer, {
  data,
  ui: initialUi({ today, syncCode, firebaseReady: sync.ready }),
});

store.subscribe((state, prev, action) => {
  if (state.data !== prev.data) {
    saveData(state.data);
    if (action.type !== A.DATA_APPLY_REMOTE) sync.notifyChange();
  }
  render(state);
});

mountApp({ store, sync });
if (migrated) toast("✨", "데이터를 새 형식으로 옮겼어요");

if (syncCode && sync.ready) {
  sync.resume(syncCode, store.getState().data, today)
    .then((remote) => { if (remote) store.dispatch({ type: A.DATA_APPLY_REMOTE, patch: remote }); })
    .catch((error) => {
      console.error("동기화 재연결 실패:", error);
      store.dispatch({ type: A.UI_SET, patch: { syncConnected: false } });
      const denied = error?.code === "permission-denied";
      toast("⚠️", denied ? "동기화 권한 오류. Firestore 규칙을 확인해 주세요" : "동기화 재연결에 실패했어요");
    });
}

// 스크립트 오류 시 최소한 원인을 볼 수 있게 한다.
window.addEventListener("error", (event) => console.error("앱 오류:", event.error || event.message));
export { store, sync, setSyncCode };

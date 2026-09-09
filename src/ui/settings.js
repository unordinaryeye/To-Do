import { h } from "../utils/dom.js";
import { formatBackupTime } from "../utils/date.js";
import { activeHabits, recordedDayCount } from "../state/selectors.js";
import { getLastBackup } from "../storage/local.js";

function syncSection(ui, draft) {
  if (!ui.firebaseReady) {
    return h("div", { class: "sync-section sync-error" },
      h("div", { class: "sec-title" }, "⚠️ Firebase 미설정"),
      h("p", { class: "sync-error-text" }, "src/config.js의 FIREBASE_CONFIG에", h("br"), "Firebase 프로젝트 정보를 입력해주세요."),
    );
  }
  if (ui.syncCode) {
    return h("div", { class: "sync-section" },
      h("div", { class: "sec-title" }, "🔗 동기화 연결됨"),
      h("div", { class: "sync-code-display" }, ui.syncCode),
      h("p", { class: "sync-status" },
        h("span", { class: `sync-dot ${ui.syncConnected ? "online" : "offline"}`, style: { verticalAlign: "middle" } }),
        ` ${ui.syncConnected ? "실시간 동기화 중" : "재연결 시도 중..."}`,
      ),
      h("button", { class: "sync-btn sync-btn-disconnect", dataset: { action: "stopSync" } }, "동기화 해제"),
    );
  }
  return h("div", { class: "sync-section" },
    h("div", { class: "sec-title" }, "🔗 기기 동기화"),
    h("button", { class: "sync-btn sync-btn-primary", dataset: { action: "createSync" } }, "새 코드 생성"),
    h("div", { class: "sync-or" }, h("div", { class: "line" }), h("span", null, "또는 코드 입력"), h("div", { class: "line" })),
    h("input", { class: "sync-input", id: "syncCodeField", placeholder: "6자리 코드", maxlength: "6", value: draft, dataset: { draft: "sync", enter: "joinSync" } }),
    h("button", { class: "sync-btn sync-btn-secondary", dataset: { action: "joinSync" } }, "연결"),
  );
}

function settingsItem(icon, iconBg, main, sub, dataset, extraClass = "") {
  return h("div", { class: `settings-item ${extraClass}`.trim(), dataset },
    h("div", { class: "si-icon", style: { background: iconBg } }, icon),
    h("div", { class: "si-text" }, h("div", { class: "main" }, main), h("div", { class: "sub" }, sub)),
  );
}

export function renderSettings(state, drafts) {
  const habitCount = activeHabits(state.data).length;
  const days = recordedDayCount(state.data);
  return h("div", { class: "overlay", dataset: { action: "closeOverlay" } },
    h("div", { class: "settings-panel" },
      h("div", { class: "panel-handle" }),
      h("div", { class: "panel-head" },
        h("div", { class: "panel-title", style: { marginBottom: "0" } }, "설정"),
        h("button", { class: "panel-close", dataset: { action: "closeSettings" }, "aria-label": "닫기" }, "✕"),
      ),
      syncSection(state.ui, drafts.sync),
      h("div", { class: "section-divider" }),
      settingsItem("💾", "#DBEAFE", "데이터 백업", `파일로 백업 · 마지막: ${formatBackupTime(getLastBackup())}`, { action: "backup" }),
      settingsItem("📂", "#FEF3C7", "데이터 복원", "백업 파일에서 복원", { action: "restore" }),
      settingsItem("📊", "#F3E8FF", "내 기록", `루틴 ${habitCount}개 · 기록된 날 ${days}일`, {}, "settings-info"),
      h("div", { style: { height: "8px" } }),
      settingsItem("🗑️", "#FEE2E2", "전체 초기화", "모든 데이터 삭제", { action: "askReset" }, "settings-danger"),
      h("button", { class: "panel-close-btn", dataset: { action: "closeSettings" } }, "닫기"),
    ),
  );
}

export function renderConfirmReset() {
  return h("div", { class: "overlay center", dataset: { action: "closeOverlay" } },
    h("div", { class: "confirm-box" },
      h("div", { style: { fontSize: "36px", marginBottom: "12px" } }, "⚠️"),
      h("div", { class: "msg" }, "모든 루틴과 기록이 삭제됩니다.", h("br"), "정말 초기화할까요?"),
      h("div", { class: "btns" },
        h("button", { class: "btn-cancel", dataset: { action: "closeConfirm" } }, "취소"),
        h("button", { class: "btn-danger", dataset: { action: "reset" } }, "초기화"),
      ),
    ),
  );
}

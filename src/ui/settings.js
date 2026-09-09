import { h } from "../utils/dom.js";
import { formatBackupTime, ISO_DAYS_KR, todayKey } from "../utils/date.js";
import { activeHabits, recordedDayCount, endedHabits } from "../state/selectors.js";
import { getLastBackup } from "../storage/local.js";
import { SCHEMA_VERSION } from "../config.js";
import { listItem } from "./parts.js";

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

function weekStartRow(settings) {
  const current = settings.weekStart ?? 1;
  return h("div", { class: "list-item static" },
    h("div", { class: "li-icon" }, "🗓"),
    h("div", { class: "li-text" }, h("div", { class: "main" }, "주 시작 요일"), h("div", { class: "sub" }, "주간 행과 통계 그리드에 적용")),
    h("div", { class: "li-right" }, h("select", { dataset: { action: "setWeekStart" } },
      [1, 7, 6].map((d) => h("option", { value: String(d), selected: current === d }, `${ISO_DAYS_KR[d]}요일`)))),
  );
}

function themeRow(settings) {
  const current = settings.theme || "system";
  return h("div", { class: "list-item static" },
    h("div", { class: "li-icon" }, "🌙"),
    h("div", { class: "li-text" }, h("div", { class: "main" }, "테마"), h("div", { class: "sub" }, "다크 모드")),
    h("div", { class: "li-right" }, h("select", { dataset: { action: "setTheme" } },
      [["system", "시스템 따라가기"], ["light", "라이트"], ["dark", "다크"]].map(([v, l]) => h("option", { value: v, selected: current === v }, l)))),
  );
}

function sortRow(settings) {
  const on = settings.sortByTime !== false;
  return h("div", { class: "list-item static" },
    h("div", { class: "li-icon" }, "🕒"),
    h("div", { class: "li-text" }, h("div", { class: "main" }, "시간순 자동 정렬"), h("div", { class: "sub" }, "시간이 있는 루틴을 홈에서 시간순으로 먼저 보여줘요")),
    h("div", { class: "li-right" }, h("select", { dataset: { action: "setSortByTime" } },
      h("option", { value: "on", selected: on }, "켬"), h("option", { value: "off", selected: !on }, "끔"))),
  );
}

export function renderSettings(state, drafts) {
  const habitCount = activeHabits(state.data).length;
  const days = recordedDayCount(state.data);
  const ended = endedHabits(state.data, todayKey()).length;
  return h("div", { class: "screen fade-in" },
    h("div", { class: "page-title" }, "내정보"),
    syncSection(state.ui, drafts.sync),
    h("div", { class: "section-divider" }),
    listItem({ icon: "💾", iconBg: "#DBEAFE", main: "데이터 백업", sub: `파일로 백업 · 마지막: ${formatBackupTime(getLastBackup())}`, dataset: { action: "backup" } }),
    listItem({ icon: "📂", iconBg: "#FEF3C7", main: "데이터 복원", sub: "백업 파일에서 복원", dataset: { action: "restore" } }),
    weekStartRow(state.data.settings),
    sortRow(state.data.settings),
    themeRow(state.data.settings),
    listItem({ icon: "⛔", iconBg: "#F5F5F4", main: "끝낸 루틴", sub: ended ? `${ended}개 · 탭해서 다시 시작` : "없음", dataset: { action: "openEnded" } }),
    listItem({ icon: "📊", iconBg: "#F3E8FF", main: "내 기록", sub: `루틴 ${habitCount}개 · 기록된 날 ${days}일 · 탭해서 통계 보기`, right: "›", dataset: { action: "goRoute", route: "stats" } }),
    h("div", { style: { height: "8px" } }),
    listItem({ icon: "🗑️", iconBg: "#FEE2E2", main: "전체 초기화", sub: "모든 데이터 삭제", dataset: { action: "askReset" }, danger: true }),
    h("div", { class: "version" }, `Daily Routine · 데이터 스키마 v${SCHEMA_VERSION}`),
  );
}

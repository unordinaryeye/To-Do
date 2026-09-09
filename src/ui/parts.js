import { h } from "../utils/dom.js";

export function chip(label, { on = false, dark = false, small = false, dataset } = {}) {
  const cls = ["chip", on && "on", dark && "dark", small && "sm"].filter(Boolean).join(" ");
  return h("button", { class: cls, dataset }, label);
}

/** ▲▼ 이동 버튼 쌍. 첫/마지막 항목이면 비활성. */
export function moveButtons(action, id, { isFirst, isLast }) {
  const btn = (dir, label, disabled) => h("button", { class: `move-btn${disabled ? " disabled" : ""}`, dataset: { action, id, dir }, "aria-label": label, disabled }, dir === "-1" ? "▲" : "▼");
  return h("div", { class: "move-group" }, btn("-1", "위로", isFirst), btn("1", "아래로", isLast));
}

export function emptyState(icon, main, sub) {
  return h("div", { class: "empty-state" },
    h("div", { class: "big" }, icon),
    h("p", { class: "main" }, main),
    sub ? h("p", { class: "sub" }, sub) : null,
  );
}

export function listItem({ icon, iconBg, main, sub, right, dataset, danger = false, isStatic = false }) {
  const cls = ["list-item", danger && "danger", isStatic && "static"].filter(Boolean).join(" ");
  return h("div", { class: cls, dataset },
    h("div", { class: "li-icon", style: iconBg ? { background: iconBg } : undefined }, icon),
    h("div", { class: "li-text" }, h("div", { class: "main" }, main), sub ? h("div", { class: "sub" }, sub) : null),
    right ? h("div", { class: "li-right" }, right) : null,
  );
}

/** 바텀시트 껍데기. 배경 탭으로 닫힌다. */
export function sheet(children, { title, sub } = {}) {
  return h("div", { class: "overlay", dataset: { action: "closeSheet" } },
    h("div", { class: "sheet" },
      h("div", { class: "sheet-handle" }),
      title ? h("div", { class: "sheet-title" }, title) : null,
      sub ? h("div", { class: "sheet-sub" }, sub) : null,
      ...children,
    ),
  );
}

export function actionItem(label, icon, dataset, { danger = false, disabled = false } = {}) {
  const cls = ["action-item", danger && "danger", disabled && "disabled"].filter(Boolean).join(" ");
  return h("div", { class: cls, dataset }, h("span", null, label), h("span", { class: "ico" }, icon));
}

export function confirmBox(message, confirmLabel, confirmDataset, { danger = true } = {}) {
  return h("div", { class: "overlay center", dataset: { action: "closeSheet" } },
    h("div", { class: "confirm-box" },
      h("div", { style: { fontSize: "36px", marginBottom: "12px" } }, "⚠️"),
      h("div", { class: "msg" }, message),
      h("div", { class: "btns" },
        h("button", { class: "btn ghost", dataset: { action: "closeSheet" } }, "취소"),
        h("button", { class: `btn ${danger ? "danger" : "primary"}`, dataset: confirmDataset }, confirmLabel),
      ),
    ),
  );
}

/** 전체 화면 페이지 껍데기 */
export function page(title, { confirmLabel, confirmDataset, confirmReady = true, backDataset = { action: "closePage" } }, ...children) {
  return h("div", { class: "page" },
    h("div", { class: "page-inner" },
      h("div", { class: "page-head" },
        h("button", { class: "back", dataset: backDataset, "aria-label": "뒤로" }, "‹"),
        h("div", { class: "title" }, title),
        confirmLabel
          ? h("button", { class: `confirm${confirmReady ? " ready" : ""}`, dataset: confirmDataset }, confirmLabel)
          : h("div", { style: { width: "44px" } }),
      ),
      ...children,
    ),
  );
}

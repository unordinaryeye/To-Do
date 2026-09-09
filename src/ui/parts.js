import { h, svgCheck } from "../utils/dom.js";

/** ▲▼ 이동 버튼 쌍. 첫/마지막 항목이면 비활성 모양. */
export function moveButtons(action, id, { isFirst, isLast, marginRight = false }) {
  return h("div", { class: `move-group${marginRight ? " mr" : ""}` },
    h("button", { class: `move-btn${isFirst ? " disabled" : ""}`, dataset: { action, id, dir: "-1" }, "aria-label": "위로" }, "▲"),
    h("button", { class: `move-btn${isLast ? " disabled" : ""}`, dataset: { action, id, dir: "1" }, "aria-label": "아래로" }, "▼"),
  );
}

export function checkbox(checked, color, dataset) {
  return h("div", {
    class: `checkbox ${checked ? "checked check-pop" : "unchecked"}`,
    style: checked ? { background: color } : undefined,
    dataset,
    role: "checkbox",
    "aria-checked": String(checked),
  }, checked ? svgCheck() : null);
}

export function groupHeader(color, label, countText) {
  return h("div", { class: "group-header" },
    h("div", { class: "group-bar", style: { background: color } }),
    h("span", { class: "group-label" }, label),
    h("span", { class: "group-count" }, countText),
  );
}

export function emptyState(icon, ...lines) {
  return h("div", { class: "empty-state" },
    h("div", { style: { fontSize: "40px", marginBottom: "12px" } }, icon),
    ...lines,
  );
}

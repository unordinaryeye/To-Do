/**
 * 문자열 템플릿 대신 DOM 노드를 직접 만든다. 사용자 입력은 항상 textContent로 들어가므로
 * 따옴표나 태그가 마크업을 깨뜨리지 않는다.
 *
 * h("div", { class: "a", dataset: { action: "x" }, style: { color: "red" } }, "text", childNode)
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "dataset") Object.assign(el.dataset, value);
    else if (key === "style" && typeof value === "object") Object.assign(el.style, value);
    else if (key === "value") el.value = value;
    else if (key === "checked" || key === "selected" || key === "disabled") el[key] = !!value;
    else el.setAttribute(key, value === true ? "" : value);
  }
  appendChildren(el, children);
  return el;
}

export function appendChildren(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function svgCheck() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", "12");
  svg.setAttribute("height", "12");
  svg.setAttribute("viewBox", "0 0 12 12");
  svg.setAttribute("fill", "none");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", "M2.5 6L5 8.5L9.5 3.5");
  path.setAttribute("stroke", "#fff");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  return svg;
}

/** 기존 노드를 새 노드로 교체하되, 포커스가 있던 input이 같은 id로 다시 있으면 포커스를 되살린다. */
export function replaceContent(root, ...nodes) {
  const active = document.activeElement;
  const focusId = active && root.contains(active) ? active.id : null;
  const selection = focusId && "selectionStart" in active ? [active.selectionStart, active.selectionEnd] : null;
  root.replaceChildren(...nodes.flat(Infinity).filter(Boolean));
  if (!focusId) return;
  const next = document.getElementById(focusId);
  if (!next) return;
  next.focus();
  if (selection && "setSelectionRange" in next) {
    try { next.setSelectionRange(selection[0], selection[1]); } catch { /* 타입이 다른 input */ }
  }
}

/** 렌더는 동기적이므로 대개 즉시 찾는다. 못 찾으면 다음 프레임에 한 번 더 시도한다. */
export function focusById(id) {
  const el = document.getElementById(id);
  if (el) { el.focus(); return; }
  requestAnimationFrame(() => document.getElementById(id)?.focus());
}

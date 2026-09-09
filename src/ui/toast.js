import { h } from "../utils/dom.js";

const TOAST_MS = 2500;
const OUT_MS = 300;
let timer = null;

export function toast(emoji, message) {
  const root = document.getElementById("toast-root");
  root.replaceChildren(h("div", { class: "toast" }, `${emoji} ${message}`));
  clearTimeout(timer);
  timer = setTimeout(() => {
    const el = root.firstElementChild;
    if (!el) return;
    el.classList.add("out");
    setTimeout(() => root.replaceChildren(), OUT_MS);
  }, TOAST_MS);
}

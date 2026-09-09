import { h } from "../utils/dom.js";

export const ROUTES = [
  { id: "home", label: "홈", icon: "🏠" },
  { id: "stats", label: "통계", icon: "📊" },
  { id: "goals", label: "목표", icon: "🎯" },
  { id: "settings", label: "내정보", icon: "👤" },
];

const isRoute = (id) => ROUTES.some((r) => r.id === id);

export function routeFromHash(hash = location.hash) {
  const id = hash.replace(/^#\/?/, "");
  return isRoute(id) ? id : "home";
}

export function hashFor(route) {
  return `#/${route}`;
}

export function renderTabBar(active) {
  const item = (r) => h("button", { class: `tab-item${active === r.id ? " active" : ""}`, dataset: { action: "goRoute", route: r.id } },
    h("span", { class: "ico" }, r.icon), h("span", null, r.label));
  const add = h("div", { class: "tab-item tab-add" },
    h("button", { class: "tab-add-btn", dataset: { action: "openFab" }, "aria-label": "추가" }, "+"));
  return h("nav", { class: "tabbar" },
    h("div", { class: "tabbar-inner" }, item(ROUTES[0]), item(ROUTES[1]), add, item(ROUTES[2]), item(ROUTES[3])),
  );
}

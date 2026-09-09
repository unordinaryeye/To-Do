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
  return h("nav", { class: "tabbar" },
    h("div", { class: "tabbar-inner" }, ROUTES.map((r) =>
      h("button", { class: `tab-item${active === r.id ? " active" : ""}`, dataset: { action: "goRoute", route: r.id } },
        h("span", { class: "ico" }, r.icon), h("span", null, r.label)))),
  );
}

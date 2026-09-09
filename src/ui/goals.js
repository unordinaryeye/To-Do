import { h } from "../utils/dom.js";
import { todayKey } from "../utils/date.js";
import { activeHabits, activeTags } from "../state/selectors.js";
import { currentPolicy } from "../domain/schedule.js";
import { monthlyStats } from "../domain/metrics.js";
import { normalizeMandalart } from "../domain/mandala.js";
import { listItem, emptyState } from "./parts.js";

function mandalartCards(state) {
  const list = Object.values(state.data.mandalarts || {}).map(normalizeMandalart);
  return h("div", null,
    h("div", { class: "page-title-row" },
      h("div", { class: "section-title" }, "만다라트"),
      h("button", { class: "btn ghost sm", dataset: { action: "newMandalart" } }, "+ 만다라트"),
    ),
    list.length ? list.map((m) => listItem({
      icon: m.emoji, main: m.title || "제목 없음", sub: `목표 ${m.slots.filter(Boolean).length}/8칸 · 탭해서 열기`, right: "›",
      dataset: { action: "openMandalart", id: m.id },
    })) : emptyState("🔲", "만다라트가 없어요", "핵심 목표 하나를 가운데 두고 8개 목표, 64개 루틴으로 펼쳐요"),
  );
}

export function renderGoals(state) {
  const today = todayKey();
  const { habits, checks } = state.data;
  const stats = monthlyStats(habits, checks, today.slice(0, 7), today);
  const active = activeHabits(state.data);
  const rows = activeTags(state.data).map((tag) => {
    const members = active.filter((habit) => (currentPolicy(habit, today)?.goalTagIds || []).includes(tag.id));
    const memberRows = stats.perHabit.filter((row) => members.some((m) => m.id === row.habit.id));
    const scheduled = memberRows.reduce((s, r) => s + r.scheduled, 0);
    const done = memberRows.reduce((s, r) => s + r.done, 0);
    const pct = scheduled ? Math.round((done / scheduled) * 100) : null;
    return listItem({
      icon: tag.emoji, iconBg: `${tag.color}22`, main: tag.name,
      sub: `루틴 ${members.length}개 · 이번 달 ${pct == null ? "–" : pct + "%"}`,
      right: "›",
      dataset: { action: "openTagActions", id: tag.id },
    });
  });
  return h("div", { class: "screen fade-in" },
    h("div", { class: "page-title" }, "목표"),
    mandalartCards(state),
    h("div", { class: "page-title-row", style: { marginTop: "18px" } },
      h("div", { class: "section-title" }, "목표 태그"),
      h("button", { class: "btn ghost sm", dataset: { action: "openTagForm" } }, "+ 목표"),
    ),
    rows.length ? rows : emptyState("🎯", "목표 태그가 없어요", "오른쪽 위 + 목표로 만들어요"),
    h("div", { class: "version" }, "만다라트 → 목표 → 루틴 순서로 들어가요. 루틴에 목표 태그를 붙이면 그 목표 칸에 자동으로 들어가요"),
  );
}

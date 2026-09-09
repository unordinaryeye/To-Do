import { h } from "../utils/dom.js";
import { todayKey } from "../utils/date.js";
import { activeHabits, activeTags } from "../state/selectors.js";
import { currentPolicy } from "../domain/schedule.js";
import { monthlyStats, isHabitDone } from "../domain/metrics.js";
import { normalizeMandalart, mandalartProgress, fillCount, habitsForSector, SLOT_TO_CELL } from "../domain/mandala.js";
import { page, sheet, listItem, emptyState } from "./parts.js";

/** 오늘 정책 기준으로 태그가 붙은 활성 습관(표시 순서). 파생 데이터라 매 렌더 계산해도 가볍다. */
function taggedHabits(state) {
  const today = todayKey();
  return activeHabits(state.data).map((habit) => ({ ...habit, goalTagIds: currentPolicy(habit, today)?.goalTagIds || [] }));
}

function pctMaps(state, habits) {
  const today = todayKey();
  const stats = monthlyStats(state.data.habits, state.data.checks, today.slice(0, 7), today);
  const pctByHabit = Object.fromEntries(stats.perHabit.map((row) => [row.habit.id, row.pct]));
  const pctByTag = {};
  for (const tag of activeTags(state.data)) {
    const nums = habits.filter((hb) => hb.goalTagIds.includes(tag.id)).map((hb) => pctByHabit[hb.id]).filter((v) => typeof v === "number");
    pctByTag[tag.id] = nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
  }
  return { pctByHabit, pctByTag };
}

function pctStyle(pct) {
  return pct == null ? undefined : { background: `linear-gradient(to top, var(--accent-soft) ${pct}%, transparent ${pct}%)` };
}

function cell(content, { center = false, empty = false, pct = null, dataset, sub, done = false } = {}) {
  const cls = ["md-cell", center && "center", empty && "empty", done && "done"].filter(Boolean).join(" ");
  return h("button", { class: cls, style: center ? undefined : pctStyle(pct), dataset, disabled: !dataset },
    h("span", { class: "md-text" }, content),
    sub != null ? h("span", { class: "md-sub" }, sub) : null,
  );
}

const grid = (cells) => h("div", { class: "mandala-grid large" }, cells);

/** 1단: 중앙=만다라트, 주변 8=목표 태그 */
function overview(state, m, progress) {
  const cells = new Array(9);
  cells[4] = cell(`${m.emoji} ${m.title || "만다라트"}`, { center: true, sub: progress.pct == null ? "탭해서 제목 수정" : `${progress.pct}%`, dataset: { action: "editMandalartTitle", id: m.id } });
  m.slots.forEach((tagId, i) => {
    const tag = tagId && state.data.goalTags[tagId];
    const pct = progress.sectors[i];
    cells[SLOT_TO_CELL[i]] = tag
      ? cell(`${tag.emoji} ${tag.name}`, { pct, sub: pct == null ? "루틴 없음" : `${pct}%`, dataset: { action: "openMandalartSector", id: m.id, slot: String(i) } })
      : cell("+", { empty: true, sub: "목표 놓기", dataset: { action: "openSlotPicker", id: m.id, slot: String(i) } });
  });
  return grid(cells);
}

/** 2단: 중앙=목표 태그, 주변 8=루틴 */
function zoom(state, m, slot, habits, pctByHabit) {
  const tagId = m.slots[slot];
  const tag = state.data.goalTags[tagId];
  const { cells: habitCells, rest } = habitsForSector(habits, tagId);
  const today = todayKey();
  const cells = new Array(9);
  cells[4] = cell(`${tag.emoji} ${tag.name}`, { center: true, sub: "탭해서 다른 목표로 바꾸기", dataset: { action: "openSlotPicker", id: m.id, slot: String(slot) } });
  habitCells.forEach((habit, j) => {
    cells[SLOT_TO_CELL[j]] = habit
      ? cell(`${habit.emoji} ${habit.name}`, {
        pct: pctByHabit[habit.id] ?? null, done: isHabitDone(habit, state.data.checks, today),
        sub: pctByHabit[habit.id] == null ? "" : `${pctByHabit[habit.id]}%`,
        dataset: { action: "openHabitActions", id: habit.id },
      })
      : cell("+", { empty: true, sub: "루틴 추가", dataset: { action: "openHabitForm", presetTag: tagId } });
  });
  return [grid(cells), rest.length ? h("p", { class: "card-meta", style: { marginTop: "10px" } }, `이 목표의 루틴이 8개를 넘어 ${rest.length}개는 표에 안 보여요 (홈에는 모두 보여요)`) : null];
}

export function renderMandalartPage(state) {
  const { id, slot } = state.ui.page;
  const raw = state.data.mandalarts?.[id];
  if (!raw) return page("만다라트", {}, emptyState("🔲", "만다라트를 찾을 수 없어요"));
  const m = normalizeMandalart(raw);
  const habits = taggedHabits(state);
  const { pctByHabit, pctByTag } = pctMaps(state, habits);
  const progress = mandalartProgress(m, pctByTag);
  const counts = Object.fromEntries(activeTags(state.data).map((t) => [t.id, habits.filter((hb) => hb.goalTagIds.includes(t.id)).length]));
  const count = fillCount(m, counts);
  const zoomed = slot != null && m.slots[slot] && state.data.goalTags[m.slots[slot]];
  const back = zoomed ? { action: "openMandalart", id } : { action: "closePage" };
  const title = zoomed ? `${state.data.goalTags[m.slots[slot]].emoji} ${state.data.goalTags[m.slots[slot]].name}` : `${m.emoji} ${m.title || "만다라트"}`;
  return page(title, { confirmLabel: zoomed ? null : "표", confirmDataset: { action: "openMandalartFull", id }, backDataset: back },
    h("p", { class: "card-meta", style: { margin: "4px 0 12px" } }, zoomed
      ? "루틴을 탭하면 수정·기록, 빈 칸을 탭하면 이 목표의 루틴을 만들어요."
      : `목표 ${count.tags}/8 · 루틴 ${count.habits}/64 · 빈 칸을 탭해 목표를 놓고, 목표를 탭하면 루틴이 보여요`),
    zoomed ? zoom(state, m, slot, habits, pctByHabit) : overview(state, m, progress),
    zoomed ? h("div", { class: "md-nav" },
      h("button", { class: "btn ghost", dataset: { action: "openMandalartSector", id, slot: String((slot + 7) % 8) } }, "‹ 이전 목표"),
      h("button", { class: "btn ghost", dataset: { action: "openMandalartSector", id, slot: String((slot + 1) % 8) } }, "다음 목표 ›"),
    ) : null,
  );
}

/** 9×9 읽기 전용 표: 가운데 블록=만다라트+목표, 주변 블록=목표+루틴 */
export function renderMandalartFull(state) {
  const { id } = state.ui.page;
  const m = normalizeMandalart(state.data.mandalarts?.[id]);
  const habits = taggedHabits(state);
  const tagName = (tagId) => { const t = tagId && state.data.goalTags[tagId]; return t ? `${t.emoji} ${t.name}` : ""; };
  const blocks = new Array(9);
  blocks[4] = block(`${m.emoji} ${m.title}`, m.slots.map(tagName), true);
  m.slots.forEach((tagId, i) => {
    const names = tagId ? habitsForSector(habits, tagId).cells.map((hb) => (hb ? `${hb.emoji} ${hb.name}` : "")) : Array(8).fill("");
    blocks[SLOT_TO_CELL[i]] = block(tagName(tagId), names, false);
  });
  return page("만다라트 9×9", { backDataset: { action: "openMandalart", id } },
    h("div", { class: "md-full-wrap" }, h("div", { class: "md-full" }, blocks)),
    h("p", { class: "legend" }, "가로로 스크롤해서 전체를 볼 수 있어요"),
  );
}

function block(centerText, around, isCenterBlock) {
  const cells = new Array(9);
  cells[4] = h("div", { class: `md-mini center${isCenterBlock ? " core" : ""}` }, centerText || "");
  around.forEach((text, i) => { cells[SLOT_TO_CELL[i]] = h("div", { class: `md-mini${isCenterBlock ? " sector" : ""}` }, text || ""); });
  return h("div", { class: "md-block" }, cells);
}

/** 제목·이모지 시트 */
export function titleSheet(state, drafts) {
  const { id } = state.ui.sheet;
  const m = normalizeMandalart(state.data.mandalarts?.[id]);
  const isNew = !state.data.mandalarts?.[id];
  return sheet([
    h("div", { class: "form-name", style: { margin: "0 0 12px" } },
      h("button", { class: "emoji-btn", dataset: { action: "openEmojiSheet" }, "aria-label": "이모지 선택" }, state.ui.sheet.emoji || m.emoji),
      h("input", { id: "mandalartTitleField", value: drafts.mandalaText, placeholder: "핵심 목표 (예: 건강하고 성장하는 한 해)", maxlength: "30", dataset: { draft: "mandalaText", enter: "submitMandalartTitle" } }),
    ),
    h("div", { class: "btn-row" },
      isNew ? null : h("button", { class: "btn danger-ghost", dataset: { action: "askDeleteMandalart", id } }, "삭제"),
      h("button", { class: "btn primary", dataset: { action: "submitMandalartTitle" } }, isNew ? "만들기" : "저장"),
    ),
  ], { title: isNew ? "새 만다라트" : "만다라트 제목", sub: "가운데 칸에 들어갈 핵심 목표예요" });
}

/** 칸에 놓을 목표 태그 고르기 */
export function slotPickerSheet(state) {
  const { id, slot } = state.ui.sheet;
  const m = normalizeMandalart(state.data.mandalarts?.[id]);
  const current = m.slots[slot];
  const tags = activeTags(state.data);
  return sheet([
    tags.length ? tags.map((tag) => {
      const placedAt = m.slots.indexOf(tag.id);
      const on = tag.id === current;
      return listItem({ icon: tag.emoji, iconBg: `${tag.color}22`, main: tag.name, isStatic: true,
        sub: placedAt >= 0 && !on ? `${placedAt + 1}번 칸에 있음 · 여기로 옮기기` : null,
        right: h("button", { class: `btn ${on ? "primary" : "ghost"} sm`, dataset: { action: "placeTag", id, slot: String(slot), tagId: tag.id } }, on ? "선택됨" : "놓기") });
    }) : emptyState("🏷", "목표 태그가 없어요", "아래에서 새 목표를 만들어요"),
    current ? h("button", { class: "btn danger-ghost block", dataset: { action: "placeTag", id, slot: String(slot), tagId: "" } }, "이 칸 비우기") : null,
    h("button", { class: "btn ghost block", dataset: { action: "openTagForm", from: "mandalart" } }, "+ 새 목표 만들기"),
    h("button", { class: "sheet-close", dataset: { action: "closeSheet" } }, "닫기"),
  ], { title: `${slot + 1}번 칸에 놓을 목표`, sub: "목표 안의 루틴은 그 목표 태그가 붙은 루틴이 자동으로 들어가요" });
}

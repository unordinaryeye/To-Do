import { h } from "../utils/dom.js";
import { todayKey } from "../utils/date.js";
import { activeHabits } from "../state/selectors.js";
import { monthlyStats } from "../domain/metrics.js";
import { normalizeMandala, mandalaProgress, fillCount, SLOT_TO_CELL } from "../domain/mandala.js";
import { page, sheet, listItem } from "./parts.js";

/** 이번 달 습관별 달성률 맵 */
function pctByHabit(state) {
  const today = todayKey();
  const stats = monthlyStats(state.data.habits, state.data.checks, today.slice(0, 7), today);
  return Object.fromEntries(stats.perHabit.map((row) => [row.habit.id, row.pct]));
}

function pctStyle(pct) {
  if (pct == null) return undefined;
  return { background: `linear-gradient(to top, var(--accent-soft) ${pct}%, transparent ${pct}%)` };
}

/** 3×3 격자. cells[0..8], 4는 중앙 */
function grid3(cells, { large = false } = {}) {
  return h("div", { class: `mandala-grid${large ? " large" : ""}` }, cells);
}

function cell(content, { center = false, empty = false, pct = null, dataset, sub } = {}) {
  const cls = ["md-cell", center && "center", empty && "empty"].filter(Boolean).join(" ");
  return h("button", { class: cls, style: center ? undefined : pctStyle(pct), dataset, disabled: !dataset },
    h("span", { class: "md-text" }, content),
    sub != null ? h("span", { class: "md-sub" }, sub) : null,
  );
}

/** 개요: 중앙=목표, 주변 8=세부목표 */
function overview(state, tag, mandala, progress) {
  const cells = new Array(9);
  cells[4] = cell(`${tag.emoji} ${tag.name}`, { center: true, sub: progress.pct == null ? "" : `${progress.pct}%` });
  mandala.sectors.forEach((sector, i) => {
    const text = sector.text.trim();
    const pct = progress.sectors[i].pct;
    cells[SLOT_TO_CELL[i]] = cell(text || "+", {
      empty: !text, pct, sub: text && pct != null ? `${pct}%` : null,
      dataset: text ? { action: "openMandalaSector", tagId: tag.id, sector: String(i) } : { action: "editMandalaSector", tagId: tag.id, sector: String(i) },
    });
  });
  return grid3(cells, { large: true });
}

/** 확대: 중앙=세부목표, 주변 8=실천항목 */
function zoom(state, tag, mandala, progress, sectorIndex) {
  const sector = mandala.sectors[sectorIndex];
  const cells = new Array(9);
  cells[4] = cell(sector.text || "세부목표", { center: true, sub: progress.sectors[sectorIndex].pct == null ? "" : `${progress.sectors[sectorIndex].pct}%`,
    dataset: { action: "editMandalaSector", tagId: tag.id, sector: String(sectorIndex) } });
  sector.actions.forEach((action, j) => {
    const text = action.text.trim();
    const pct = progress.sectors[sectorIndex].actions[j];
    const linked = action.habitIds.filter((id) => state.data.habits[id]).length;
    cells[SLOT_TO_CELL[j]] = cell(text || "+", {
      empty: !text, pct, sub: linked ? `🔗${linked}${pct != null ? ` · ${pct}%` : ""}` : null,
      dataset: { action: "openMandalaCell", tagId: tag.id, sector: String(sectorIndex), cell: String(j) },
    });
  });
  return grid3(cells, { large: true });
}

export function renderMandalaPage(state) {
  const { tagId, sector } = state.ui.page;
  const tag = state.data.goalTags[tagId];
  if (!tag) return page("만다라트", {}, h("div", { class: "empty-state" }, h("p", { class: "main" }, "목표를 찾을 수 없어요")));
  const mandala = normalizeMandala(tag.mandala);
  const progress = mandalaProgress(mandala, pctByHabit(state));
  const count = fillCount(mandala);
  const zoomed = sector != null;
  const back = zoomed ? { action: "openMandala", tagId } : { action: "closePage" };
  const title = zoomed ? (mandala.sectors[sector].text || "세부목표") : `${tag.emoji} ${tag.name}`;
  return page(title, { confirmLabel: zoomed ? null : "표", confirmDataset: { action: "openMandalaFull", tagId }, backDataset: back },
    h("p", { class: "card-meta", style: { margin: "4px 0 12px" } }, zoomed
      ? "칸을 탭해 실천항목을 적고, 습관이나 투두로 만들어요. 가운데를 탭하면 세부목표 이름을 고쳐요."
      : `세부목표 ${count.sectors}/8 · 실천항목 ${count.actions}/64 · 칸을 탭해 채워요`),
    zoomed ? zoom(state, tag, mandala, progress, sector) : overview(state, tag, mandala, progress),
    zoomed ? h("div", { class: "md-nav" },
      h("button", { class: "btn ghost", dataset: { action: "openMandalaSector", tagId, sector: String((sector + 7) % 8) } }, "‹ 이전 세부목표"),
      h("button", { class: "btn ghost", dataset: { action: "openMandalaSector", tagId, sector: String((sector + 1) % 8) } }, "다음 세부목표 ›"),
    ) : null,
  );
}

/** 9×9 읽기 전용 표 */
export function renderMandalaFull(state) {
  const { tagId } = state.ui.page;
  const tag = state.data.goalTags[tagId];
  const mandala = normalizeMandala(tag?.mandala);
  const blocks = new Array(9);
  blocks[4] = block(`${tag?.emoji ?? ""} ${tag?.name ?? ""}`, mandala.sectors.map((s) => s.text), true);
  mandala.sectors.forEach((s, i) => { blocks[SLOT_TO_CELL[i]] = block(s.text, s.actions.map((a) => a.text), false); });
  return page("만다라트 9×9", { backDataset: { action: "openMandala", tagId } },
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

/** 세부목표 이름 입력 시트 */
export function sectorSheet(state, drafts) {
  const { tagId, sector } = state.ui.sheet;
  const tag = state.data.goalTags[tagId];
  return sheet([
    h("input", { class: "text-input", id: "mandalaTextField", value: drafts.mandalaText, placeholder: "세부목표 (예: 운동 습관화)", maxlength: "20", dataset: { draft: "mandalaText", enter: "submitMandalaSector" } }),
    h("div", { class: "btn-row" },
      drafts.mandalaText ? h("button", { class: "btn danger-ghost", dataset: { action: "submitMandalaSector", clear: "1" } }, "비우기") : null,
      h("button", { class: "btn primary", dataset: { action: "submitMandalaSector" } }, "저장"),
    ),
  ], { title: `${tag?.emoji ?? ""} ${tag?.name ?? ""} › 세부목표 ${sector + 1}` });
}

/** 실천항목 시트: 텍스트 + 연결 습관 + 만들기 버튼 */
export function cellSheet(state, drafts) {
  const { tagId, sector, cell: cellIndex } = state.ui.sheet;
  const tag = state.data.goalTags[tagId];
  const mandala = normalizeMandala(tag?.mandala);
  const action = mandala.sectors[sector].actions[cellIndex];
  const linked = action.habitIds.map((id) => state.data.habits[id]).filter(Boolean);
  const ds = { tagId, sector: String(sector), cell: String(cellIndex) };
  return sheet([
    h("input", { class: "text-input", id: "mandalaTextField", value: drafts.mandalaText, placeholder: "실천항목 (예: 달리기 30분)", maxlength: "30", dataset: { draft: "mandalaText", enter: "submitMandalaCell" } }),
    h("div", { class: "btn-row" },
      h("button", { class: "btn primary", dataset: { action: "submitMandalaCell" } }, "텍스트 저장"),
    ),
    linked.length ? h("div", { class: "md-linked" }, h("div", { class: "card-title", style: { fontSize: "13px" } }, "🔗 연결된 습관"),
      linked.map((habit) => listItem({ icon: habit.emoji, main: habit.name, isStatic: true,
        right: h("button", { class: "btn ghost sm", dataset: { action: "unlinkMandalaHabit", ...ds, habitId: habit.id } }, "해제") }))) : null,
    h("div", { class: "section-divider" }),
    h("div", { class: "chips" },
      h("button", { class: "chip on", dataset: { action: "mandalaToHabit", ...ds } }, "🔁 습관으로 만들기"),
      h("button", { class: "chip", dataset: { action: "mandalaToTodo", ...ds } }, "📌 투두로 만들기"),
      h("button", { class: "chip", dataset: { action: "openMandalaLink", ...ds } }, "🔗 기존 습관 연결"),
    ),
    h("button", { class: "sheet-close", dataset: { action: "closeSheet" } }, "닫기"),
  ], { title: `${mandala.sectors[sector].text || "세부목표"} › 실천항목 ${cellIndex + 1}`, sub: "습관으로 만들면 달성률이 이 칸에 채워져요" });
}

/** 기존 습관 연결 시트 */
export function linkSheet(state) {
  const { tagId, sector, cell: cellIndex } = state.ui.sheet;
  const tag = state.data.goalTags[tagId];
  const action = normalizeMandala(tag?.mandala).sectors[sector].actions[cellIndex];
  const habits = activeHabits(state.data);
  return sheet([
    habits.length ? habits.map((habit) => {
      const on = action.habitIds.includes(habit.id);
      return listItem({ icon: habit.emoji, main: habit.name, isStatic: true,
        right: h("button", { class: `btn ${on ? "primary" : "ghost"} sm`, dataset: { action: "toggleMandalaLink", tagId, sector: String(sector), cell: String(cellIndex), habitId: habit.id, on: on ? "0" : "1" } }, on ? "연결됨" : "연결") });
    }) : h("div", { class: "empty-state" }, h("p", { class: "main" }, "연결할 습관이 없어요")),
    h("button", { class: "sheet-close", dataset: { action: "backToMandalaCell", tagId, sector: String(sector), cell: String(cellIndex) } }, "돌아가기"),
  ], { title: "기존 습관 연결" });
}

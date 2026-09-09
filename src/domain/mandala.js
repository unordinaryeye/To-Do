/**
 * 만다라트(9×9): 중앙 핵심목표(=목표 태그) + 세부목표 8개 + 각 실천항목 8개 = 원본 73칸.
 * goalTags[id].mandala = { sectors: [ { text, actions: [ { text, habitIds: [] } ×8 ] } ×8 ] }
 * slot 순서(0..7): 좌상, 상, 우상, 좌, 우, 좌하, 하, 우하
 */
export const SLOT_COUNT = 8;

/** 3×3 격자에서 slot → 칸 위치(0..8, 4가 중앙) */
export const SLOT_TO_CELL = [0, 1, 2, 3, 5, 6, 7, 8];

export function emptyAction() {
  return { text: "", habitIds: [] };
}

export function emptySector() {
  return { text: "", actions: Array.from({ length: SLOT_COUNT }, emptyAction) };
}

export function emptyMandala() {
  return { sectors: Array.from({ length: SLOT_COUNT }, emptySector) };
}

/** 저장된 만다라트가 없거나 깨져 있어도 항상 8×8 형태로 돌려준다. */
export function normalizeMandala(mandala) {
  const base = emptyMandala();
  if (!mandala || !Array.isArray(mandala.sectors)) return base;
  return {
    sectors: base.sectors.map((sector, i) => {
      const src = mandala.sectors[i];
      if (!src || typeof src !== "object") return sector;
      return {
        text: typeof src.text === "string" ? src.text : "",
        actions: sector.actions.map((action, j) => {
          const a = Array.isArray(src.actions) ? src.actions[j] : null;
          if (!a || typeof a !== "object") return action;
          return { text: typeof a.text === "string" ? a.text : "", habitIds: Array.isArray(a.habitIds) ? a.habitIds.filter((x) => typeof x === "string") : [] };
        }),
      };
    }),
  };
}

const replaceAt = (arr, index, value) => arr.map((item, i) => (i === index ? value : item));

export function setSectorText(mandala, sector, text) {
  const m = normalizeMandala(mandala);
  return { sectors: replaceAt(m.sectors, sector, { ...m.sectors[sector], text }) };
}

export function setActionText(mandala, sector, action, text) {
  const m = normalizeMandala(mandala);
  const s = m.sectors[sector];
  return { sectors: replaceAt(m.sectors, sector, { ...s, actions: replaceAt(s.actions, action, { ...s.actions[action], text }) }) };
}

export function linkHabit(mandala, sector, action, habitId, on) {
  const m = normalizeMandala(mandala);
  const s = m.sectors[sector];
  const a = s.actions[action];
  const habitIds = on ? [...new Set([...a.habitIds, habitId])] : a.habitIds.filter((id) => id !== habitId);
  return { sectors: replaceAt(m.sectors, sector, { ...s, actions: replaceAt(s.actions, action, { ...a, habitIds }) }) };
}

/** 습관 id → 연결된 칸 위치 목록 [{ tagId, sector, action }] */
export function cellsLinkedToHabit(goalTags, habitId) {
  const out = [];
  for (const tag of Object.values(goalTags)) {
    if (!tag.mandala) continue;
    normalizeMandala(tag.mandala).sectors.forEach((s, si) => s.actions.forEach((a, ai) => {
      if (a.habitIds.includes(habitId)) out.push({ tagId: tag.id, sector: si, action: ai });
    }));
  }
  return out;
}

/** 채워진 칸 수: 세부목표/실천항목 */
export function fillCount(mandala) {
  const m = normalizeMandala(mandala);
  const sectors = m.sectors.filter((s) => s.text.trim()).length;
  const actions = m.sectors.reduce((n, s) => n + s.actions.filter((a) => a.text.trim()).length, 0);
  return { sectors, actions, total: sectors + actions, max: SLOT_COUNT + SLOT_COUNT * SLOT_COUNT };
}

/**
 * 달성률: 실천항목 = 연결 습관들의 pct 평균, 세부목표 = 실천항목 pct 평균(연결된 것만).
 * pctByHabit: { habitId: number|null }
 */
export function mandalaProgress(mandala, pctByHabit) {
  const m = normalizeMandala(mandala);
  const avg = (values) => {
    const nums = values.filter((v) => typeof v === "number");
    return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
  };
  const sectors = m.sectors.map((s) => {
    const actions = s.actions.map((a) => avg(a.habitIds.map((id) => pctByHabit[id])));
    return { pct: avg(actions), actions };
  });
  return { pct: avg(sectors.map((s) => s.pct)), sectors };
}

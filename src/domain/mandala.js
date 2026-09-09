/**
 * 만다라트 3단 스택: 만다라트(핵심 목표) → 8칸의 목표 태그 → 각 목표 안 8칸의 루틴.
 * 만다라트 문서는 제목과 "어느 칸에 어떤 목표를 놓았는지"만 저장한다.
 * 목표 안의 루틴은 그 태그가 붙은 활성 습관(표시 순서)에서 파생된다.
 *
 * data.mandalarts[id] = { id, title, emoji, slots: [tagId|null ×8] }
 * slot 순서(0..7): 좌상, 상, 우상, 좌, 우, 좌하, 하, 우하
 */
export const SLOT_COUNT = 8;

/** 3×3 격자에서 slot → 칸 위치(0..8, 4가 중앙) */
export const SLOT_TO_CELL = [0, 1, 2, 3, 5, 6, 7, 8];

export function emptySlots() {
  return Array.from({ length: SLOT_COUNT }, () => null);
}

/** 저장된 만다라트가 깨져 있어도 항상 slots 8칸을 보장한다. */
export function normalizeMandalart(m) {
  const slots = emptySlots().map((_, i) => (Array.isArray(m?.slots) && typeof m.slots[i] === "string" ? m.slots[i] : null));
  return { id: m?.id ?? "", title: typeof m?.title === "string" ? m.title : "", emoji: typeof m?.emoji === "string" ? m.emoji : "🎯", slots };
}

/** 칸에 목표를 놓는다. 다른 칸에 이미 있던 같은 목표는 비운다. */
export function placeTag(m, slot, tagId) {
  const base = normalizeMandalart(m);
  const slots = base.slots.map((id, i) => (i === slot ? tagId : id === tagId ? null : id));
  return { ...base, slots };
}

/** 목표 태그 하나에 들어갈 루틴 8칸: 그 태그가 붙은 습관을 표시 순서대로 앞 8개. 넘치면 rest에 담는다. */
export function habitsForSector(habits, tagId) {
  const list = habits.filter((h) => (h.goalTagIds || []).includes(tagId));
  return { cells: emptySlots().map((_, i) => list[i] ?? null), rest: list.slice(SLOT_COUNT) };
}

/** 채워진 칸 수 */
export function fillCount(m, taggedCounts) {
  const base = normalizeMandalart(m);
  const tags = base.slots.filter(Boolean).length;
  const habits = base.slots.reduce((n, tagId) => n + (tagId ? Math.min(SLOT_COUNT, taggedCounts[tagId] || 0) : 0), 0);
  return { tags, habits, max: SLOT_COUNT + SLOT_COUNT * SLOT_COUNT };
}

/**
 * 달성률: 목표 = 그 목표 루틴들의 pct 평균(연결된 것만), 만다라트 = 목표들의 평균.
 * pctByTag: { tagId: number|null }
 */
export function mandalartProgress(m, pctByTag) {
  const base = normalizeMandalart(m);
  const avg = (values) => {
    const nums = values.filter((v) => typeof v === "number");
    return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
  };
  const sectors = base.slots.map((tagId) => (tagId ? (pctByTag[tagId] ?? null) : null));
  return { pct: avg(sectors), sectors };
}

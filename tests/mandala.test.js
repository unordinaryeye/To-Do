import { suite, assertEqual, assertDeepEqual } from "./harness.js";
import { normalizeMandalart, placeTag, habitsForSector, fillCount, mandalartProgress, SLOT_TO_CELL } from "../src/domain/mandala.js";
import { rootReducer, A, initialUi } from "../src/state/reducers.js";
import { defaultData } from "../src/domain/migrate.js";
import { snapshotOf } from "../src/sync/docs.js";

const TODAY = "2026-09-09";
const fresh = () => ({ data: defaultData(TODAY), ui: initialUi({ today: TODAY, syncCode: "", firebaseReady: false }) });

suite("mandalart: 구조(만다라트 → 목표 → 루틴)", (test) => {
  test("normalize는 항상 slots 8칸", () => {
    const m = normalizeMandalart({ id: "m1", title: "건강한 삶", slots: ["health", 5, null] });
    assertEqual(m.slots.length, 8);
    assertDeepEqual(m.slots.slice(0, 3), ["health", null, null]);
    assertEqual(m.emoji, "🎯");
    assertDeepEqual(SLOT_TO_CELL, [0, 1, 2, 3, 5, 6, 7, 8]);
  });
  test("placeTag: 같은 목표는 한 칸에만, 비우기 가능", () => {
    let m = placeTag({ id: "m1", title: "t" }, 0, "health");
    m = placeTag(m, 3, "health");
    assertDeepEqual(m.slots.map((s) => s || "-"), ["-", "-", "-", "health", "-", "-", "-", "-"]);
    m = placeTag(m, 3, null);
    assertEqual(m.slots.filter(Boolean).length, 0);
  });
  test("목표 안 루틴 8칸은 태그 붙은 습관 순서대로, 넘치면 rest", () => {
    const habits = Array.from({ length: 10 }, (_, i) => ({ id: `h${i}`, order: i, goalTagIds: i % 2 ? ["health"] : ["work"] }));
    const { cells, rest } = habitsForSector(habits, "health");
    assertEqual(cells.filter(Boolean).length, 5);
    assertEqual(cells[0].id, "h1");
    assertEqual(rest.length, 0);
    const many = Array.from({ length: 10 }, (_, i) => ({ id: `h${i}`, order: i, goalTagIds: ["health"] }));
    assertEqual(habitsForSector(many, "health").rest.length, 2);
  });
  test("fillCount / progress", () => {
    const m = placeTag(placeTag({ id: "m1" }, 0, "health"), 1, "work");
    assertDeepEqual(fillCount(m, { health: 12, work: 2 }), { tags: 2, habits: 10, max: 72 });
    const p = mandalartProgress(m, { health: 80, work: null });
    assertEqual(p.pct, 80);
    assertDeepEqual(p.sectors.slice(0, 3), [80, null, null]);
  });
});

suite("mandalart: 리듀서와 동기화", (test) => {
  test("만들기/제목 수정/칸 배치/삭제", () => {
    let state = rootReducer(fresh(), { type: A.MANDALART_UPSERT, id: "m1", title: "건강한 삶", emoji: "💪" });
    assertEqual(state.data.mandalarts.m1.title, "건강한 삶");
    state = rootReducer(state, { type: A.MANDALART_PLACE, id: "m1", slot: 2, tagId: "health" });
    assertEqual(state.data.mandalarts.m1.slots[2], "health");
    state = rootReducer(state, { type: A.MANDALART_UPSERT, id: "m1", title: "더 건강한 삶", emoji: "💪" });
    assertEqual(state.data.mandalarts.m1.slots[2], "health", "제목만 바꿔도 배치 유지");
    state = rootReducer(state, { type: A.MANDALART_DELETE, id: "m1" });
    assertEqual(state.data.mandalarts.m1, undefined);
  });
  test("목표 태그를 삭제하면 만다라트 칸에서도 빠진다", () => {
    let state = rootReducer(fresh(), { type: A.MANDALART_UPSERT, id: "m1", title: "t", emoji: "🎯" });
    state = rootReducer(state, { type: A.MANDALART_PLACE, id: "m1", slot: 0, tagId: "health" });
    state = rootReducer(state, { type: A.TAG_DELETE, id: "health" });
    assertEqual(state.data.mandalarts.m1.slots[0], null);
  });
  test("mandalarts는 habits 문서에 실려 동기화된다", () => {
    const state = rootReducer(fresh(), { type: A.MANDALART_UPSERT, id: "m1", title: "t", emoji: "🎯" });
    assertEqual(snapshotOf(state.data).habits.mandalarts.m1.title, "t");
  });
});

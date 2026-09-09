import { suite, assertEqual, assertDeepEqual } from "./harness.js";
import { normalizeMandala, setSectorText, setActionText, linkHabit, cellsLinkedToHabit, fillCount, mandalaProgress, SLOT_TO_CELL } from "../src/domain/mandala.js";
import { rootReducer, A, initialUi } from "../src/state/reducers.js";
import { defaultData } from "../src/domain/migrate.js";

const TODAY = "2026-09-09";

suite("mandala: 구조", (test) => {
  test("normalize는 항상 8 세부목표 × 8 실천항목", () => {
    const m = normalizeMandala(null);
    assertEqual(m.sectors.length, 8);
    assertEqual(m.sectors[0].actions.length, 8);
    const broken = normalizeMandala({ sectors: [{ text: "운동", actions: [{ text: "달리기", habitIds: ["r4", 5] }, null] }, "x"] });
    assertEqual(broken.sectors[0].text, "운동");
    assertDeepEqual(broken.sectors[0].actions[0], { text: "달리기", habitIds: ["r4"] });
    assertEqual(broken.sectors[1].text, "");
  });
  test("slot → 3×3 위치는 중앙(4)을 건너뛴다", () => {
    assertDeepEqual(SLOT_TO_CELL, [0, 1, 2, 3, 5, 6, 7, 8]);
  });
  test("텍스트/연결 편집은 불변", () => {
    const m0 = normalizeMandala(null);
    const m1 = setSectorText(m0, 2, "수면");
    const m2 = setActionText(m1, 2, 5, "11시 취침");
    const m3 = linkHabit(m2, 2, 5, "r5", true);
    assertEqual(m0.sectors[2].text, "");
    assertEqual(m3.sectors[2].text, "수면");
    assertEqual(m3.sectors[2].actions[5].text, "11시 취침");
    assertDeepEqual(m3.sectors[2].actions[5].habitIds, ["r5"]);
    assertDeepEqual(linkHabit(m3, 2, 5, "r5", true).sectors[2].actions[5].habitIds, ["r5"], "중복 연결 없음");
    assertDeepEqual(linkHabit(m3, 2, 5, "r5", false).sectors[2].actions[5].habitIds, []);
    assertDeepEqual(fillCount(m3), { sectors: 1, actions: 1, total: 2, max: 72 });
  });
  test("달성률: 실천항목은 연결 습관 평균, 세부목표는 실천항목 평균", () => {
    let m = linkHabit(normalizeMandala(null), 0, 0, "a", true);
    m = linkHabit(m, 0, 0, "b", true);
    m = linkHabit(m, 0, 1, "c", true);
    const p = mandalaProgress(m, { a: 100, b: 50, c: 30, d: 0 });
    assertEqual(p.sectors[0].actions[0], 75);
    assertEqual(p.sectors[0].actions[1], 30);
    assertEqual(p.sectors[0].pct, 53);
    assertEqual(p.sectors[1].pct, null);
    assertEqual(p.pct, 53);
  });
});

suite("mandala: 리듀서", (test) => {
  const fresh = () => ({ data: defaultData(TODAY), ui: initialUi({ today: TODAY, syncCode: "", firebaseReady: false }) });
  test("세부목표/실천항목/연결이 목표 태그에 저장되고 습관→칸 역조회가 된다", () => {
    let state = rootReducer(fresh(), { type: A.MANDALA_SECTOR, tagId: "health", sector: 1, text: "운동" });
    state = rootReducer(state, { type: A.MANDALA_ACTION, tagId: "health", sector: 1, action: 3, text: "30분 뛰기" });
    state = rootReducer(state, { type: A.MANDALA_LINK, tagId: "health", sector: 1, action: 3, habitId: "r4", on: true });
    const m = state.data.goalTags.health.mandala;
    assertEqual(m.sectors[1].text, "운동");
    assertDeepEqual(m.sectors[1].actions[3].habitIds, ["r4"]);
    assertDeepEqual(cellsLinkedToHabit(state.data.goalTags, "r4"), [{ tagId: "health", sector: 1, action: 3 }]);
    assertEqual(rootReducer(state, { type: A.MANDALA_LINK, tagId: "없음", sector: 0, action: 0, habitId: "r1", on: true }), state);
  });
  test("HABIT_UPSERT에 id를 주면 그 id로 새 습관이 만들어진다(만다라트 연결용)", () => {
    const state = rootReducer(fresh(), { type: A.HABIT_UPSERT, id: "hx", name: "새", emoji: "✅", startDate: TODAY, endDate: null, repeatDays: [1], trigger: null, today: TODAY });
    assertEqual(state.data.habits.hx.name, "새");
  });
});

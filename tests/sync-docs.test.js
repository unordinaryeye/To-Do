import { suite, assertEqual, assertDeepEqual, assertTrue } from "./harness.js";
import { stableStringify, same, snapshotOf, diffMap, payloadFor, patchFromDoc, assembleData, emptyDocFor, HABITS_DOC } from "../src/sync/docs.js";
import { defaultData, normalizeV3 } from "../src/domain/migrate.js";

const DEL = "__DELETE__";
const TODAY = "2026-09-09";

function sample() {
  const data = defaultData(TODAY);
  return {
    ...data,
    checks: { "2026-09-09": { r1: 1 }, "2026-08-31": { r2: 1 } },
    todos: {
      t1: { id: "t1", title: "a", date: "2026-09-09", order: 0, done: false },
      t2: { id: "t2", title: "b", date: "2026-08-31", order: 0, done: true },
    },
  };
}

suite("sync/docs: 비교와 스냅샷", (test) => {
  test("stableStringify는 키 순서를 무시한다", () => {
    assertEqual(stableStringify({ a: 1, b: { c: 2, d: 3 } }), stableStringify({ b: { d: 3, c: 2 }, a: 1 }));
    assertTrue(same({ x: [1, { y: 2 }] }, { x: [1, { y: 2 }] }));
    assertEqual(same({ x: 1 }, { x: 2 }), false);
  });

  test("snapshotOf는 habits 문서 + 월별 todos/checks 문서", () => {
    const docs = snapshotOf(sample());
    assertDeepEqual(Object.keys(docs).sort(), ["checks-2026-08", "checks-2026-09", HABITS_DOC, "todos-2026-08", "todos-2026-09"].sort());
    assertDeepEqual(Object.keys(docs["todos-2026-08"].todos), ["t2"]);
    assertDeepEqual(docs["checks-2026-09"].checks, { "2026-09-09": { r1: 1 } });
  });

  test("assembleData는 문서들을 다시 하나로 합친다(왕복)", () => {
    const data = sample();
    const docs = Object.entries(snapshotOf(data)).map(([id, body]) => ({ id, body }));
    const rebuilt = normalizeV3(assembleData(docs, normalizeV3({})));
    assertTrue(same(rebuilt, normalizeV3(data)));
  });
});

suite("sync/docs: diff와 payload", (test) => {
  test("diffMap: 바뀐 키만, 사라진 키는 delete", () => {
    const diff = diffMap({ a: 1, b: 2, c: 3 }, { a: 1, b: 9, d: 4 }, DEL);
    assertDeepEqual(diff, { b: 9, d: 4, c: DEL });
  });

  test("diffMap depth 2: 날짜 → 습관 단위로 내려간다", () => {
    const prev = { "2026-09-09": { r1: 1, r2: 1 } };
    const next = { "2026-09-09": { r1: 1 }, "2026-09-10": { r3: 1 } };
    assertDeepEqual(diffMap(prev, next, DEL, 2), { "2026-09-09": { r2: DEL }, "2026-09-10": { r3: 1 } });
  });

  test("payloadFor: 변화 없으면 null, prev 없으면 통째로", () => {
    const docs = snapshotOf(sample());
    assertEqual(payloadFor(HABITS_DOC, docs[HABITS_DOC], docs[HABITS_DOC], DEL), null);
    assertDeepEqual(payloadFor("todos-2026-09", undefined, docs["todos-2026-09"], DEL), docs["todos-2026-09"]);
  });

  test("payloadFor habits: 바뀐 습관만 담고 settings는 통째로", () => {
    const data = sample();
    const next = { ...data, habits: { ...data.habits, r1: { ...data.habits.r1, name: "바뀜" } }, settings: { ...data.settings, weekStart: 7 } };
    const payload = payloadFor(HABITS_DOC, snapshotOf(data)[HABITS_DOC], snapshotOf(next)[HABITS_DOC], DEL);
    assertDeepEqual(Object.keys(payload).sort(), ["habits", "settings"]);
    assertDeepEqual(Object.keys(payload.habits), ["r1"]);
    assertEqual(payload.settings.weekStart, 7);
  });

  test("월의 항목을 모두 지우면 빈 문서와 비교해 delete가 나간다", () => {
    const data = sample();
    const prev = snapshotOf(data)["checks-2026-08"];
    const next = emptyDocFor("checks-2026-08");
    assertDeepEqual(payloadFor("checks-2026-08", prev, next, DEL), { checks: { "2026-08-31": DEL } });
  });
});

suite("sync/docs: 원격 문서 반영", (test) => {
  test("같은 내용이면 빈 patch", () => {
    const data = sample();
    const docs = snapshotOf(data);
    assertDeepEqual(patchFromDoc("todos-2026-09", docs["todos-2026-09"], data), {});
    assertDeepEqual(patchFromDoc(HABITS_DOC, docs[HABITS_DOC], data), {});
  });

  test("월 문서는 그 달만 교체하고 다른 달은 유지", () => {
    const data = sample();
    const patch = patchFromDoc("checks-2026-09", { checks: { "2026-09-10": { r1: 1 } } }, data);
    assertDeepEqual(patch.checks, { "2026-08-31": { r2: 1 }, "2026-09-10": { r1: 1 } });
  });

  test("habits 문서는 바뀐 슬라이스만", () => {
    const data = sample();
    const body = { ...snapshotOf(data)[HABITS_DOC], settings: { ...data.settings, weekStart: 7 } };
    const patch = patchFromDoc(HABITS_DOC, body, data);
    assertDeepEqual(Object.keys(patch), ["settings"]);
  });
});

import { suite, assertEqual, assertDeepEqual } from "./harness.js";
import { dayStatus, dayProgress, globalStreak, habitStreak } from "../src/domain/metrics.js";
import { makePolicy } from "../src/domain/schedule.js";

const habit = (id, overrides = {}) => ({
  id, name: id, emoji: "✅", order: 0,
  startDate: "2026-09-01", endDate: null, deletedAt: null,
  policies: [makePolicy("2026-09-01")],
  ...overrides,
});

const mwf = (id) => habit(id, { policies: [makePolicy("2026-09-01", { repeat: { days: [1, 3, 5] } })] });

suite("metrics: dayStatus / dayProgress", (test) => {
  test("예정 습관이 없으면 done/partial 모두 false", () => {
    const status = dayStatus({}, {}, "2026-09-09");
    assertDeepEqual(status, { scheduled: 0, done: 0, allDone: false, partial: false, pct: null });
  });

  test("일부 달성은 partial, 전부 달성은 allDone", () => {
    const habits = { a: habit("a"), b: habit("b") };
    assertEqual(dayStatus(habits, { "2026-09-09": { a: 1 } }, "2026-09-09").partial, true);
    assertEqual(dayStatus(habits, { "2026-09-09": { a: 1, b: 1 } }, "2026-09-09").allDone, true);
  });

  test("예정 아닌 요일의 습관은 분모에서 빠진다", () => {
    const habits = { a: habit("a"), m: mwf("m") };
    const tue = dayStatus(habits, { "2026-09-08": { a: 1 } }, "2026-09-08");
    assertEqual(tue.scheduled, 1);
    assertEqual(tue.allDone, true);
  });

  test("진행률은 습관 + 투두 합산", () => {
    const habits = { a: habit("a"), b: habit("b") };
    const todos = [{ done: true }, { done: false }];
    const p = dayProgress(habits, { "2026-09-09": { a: 1 } }, todos, "2026-09-09");
    assertEqual(p.done, 2);
    assertEqual(p.total, 4);
    assertEqual(p.pct, 50);
  });

  test("레거시 true 값도 달성으로 센다", () => {
    const habits = { a: habit("a") };
    assertEqual(dayStatus(habits, { "2026-09-09": { a: true } }, "2026-09-09").allDone, true);
  });
});

suite("metrics: globalStreak", (test) => {
  const habits = { a: habit("a") };
  const checks = { "2026-09-07": { a: 1 }, "2026-09-08": { a: 1 }, "2026-09-09": { a: 1 } };

  test("연속 달성일을 센다", () => {
    assertEqual(globalStreak(habits, checks, "2026-09-09"), 3);
  });

  test("오늘 미달성이면 어제부터 센다(유예)", () => {
    assertEqual(globalStreak(habits, checks, "2026-09-10"), 3);
  });

  test("이틀 전부터 미달성이면 0", () => {
    assertEqual(globalStreak(habits, checks, "2026-09-11"), 0);
  });

  test("예정 습관이 0인 날은 건너뛴다", () => {
    const h = { m: mwf("m") };
    const c = { "2026-09-07": { m: 1 }, "2026-09-09": { m: 1 } }; // 월, 수
    assertEqual(globalStreak(h, c, "2026-09-10"), 2); // 목: 예정 없음 → 수, 화(없음) → 월
  });

  test("시작일 이전으로는 내려가지 않는다", () => {
    const h = { a: habit("a", { startDate: "2026-09-08" }) };
    assertEqual(globalStreak(h, checks, "2026-09-09"), 2);
  });

  test("습관이 없으면 0", () => {
    assertEqual(globalStreak({}, checks, "2026-09-09"), 0);
  });
});

suite("metrics: habitStreak", (test) => {
  test("월수금 습관: 월·수 완료, 목요일 기준 스트릭 2", () => {
    const h = mwf("m");
    const c = { "2026-09-07": { m: 1 }, "2026-09-09": { m: 1 } };
    assertEqual(habitStreak(h, c, "2026-09-10"), 2);
  });

  test("금요일 미완료 후 토요일 기준이면 0", () => {
    const h = mwf("m");
    const c = { "2026-09-07": { m: 1 }, "2026-09-09": { m: 1 } };
    assertEqual(habitStreak(h, c, "2026-09-12"), 0);
  });

  test("금요일 당일 미완료면 유예되어 2", () => {
    const h = mwf("m");
    const c = { "2026-09-07": { m: 1 }, "2026-09-09": { m: 1 } };
    assertEqual(habitStreak(h, c, "2026-09-11"), 2);
  });
});

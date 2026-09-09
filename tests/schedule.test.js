import { suite, assertEqual, assertDeepEqual, assertTrue } from "./harness.js";
import { policyAt, isScheduled, withPolicy, makePolicy, scheduledHabits } from "../src/domain/schedule.js";
import { isoWeekday, addDays, addMonths, monthKey, surroundingWeek } from "../src/utils/date.js";

const habit = (overrides = {}) => ({
  id: "h1", name: "x", emoji: "✅", order: 0,
  startDate: "2026-09-01", endDate: null, deletedAt: null,
  policies: [makePolicy("2026-09-01")],
  ...overrides,
});

suite("date utils", (test) => {
  test("isoWeekday: 월=1 … 일=7", () => {
    assertEqual(isoWeekday("2026-09-07"), 1); // 월
    assertEqual(isoWeekday("2026-09-13"), 7); // 일
    assertEqual(isoWeekday("2026-09-09"), 3); // 수
  });
  test("addDays는 월/연 경계를 넘는다", () => {
    assertEqual(addDays("2026-09-30", 1), "2026-10-01");
    assertEqual(addDays("2026-01-01", -1), "2025-12-31");
    assertEqual(addDays("2028-02-28", 1), "2028-02-29"); // 윤년
  });
  test("addMonths / monthKey", () => {
    assertEqual(monthKey("2026-09-09"), "2026-09");
    assertEqual(addMonths("2026-12", 1), "2027-01");
    assertEqual(addMonths("2026-01", -1), "2025-12");
  });
  test("surroundingWeek는 선택일 ±3일", () => {
    const week = surroundingWeek("2026-09-09");
    assertEqual(week.length, 7);
    assertEqual(week[0], "2026-09-06");
    assertEqual(week[3], "2026-09-09");
    assertEqual(week[6], "2026-09-12");
  });
});

suite("schedule: policyAt / isScheduled", (test) => {
  test("매일 정책은 모든 요일에 예정", () => {
    const h = habit();
    assertTrue(isScheduled(h, "2026-09-07"));
    assertTrue(isScheduled(h, "2026-09-13"));
  });

  test("시작일 이전은 예정 아님", () => {
    assertEqual(isScheduled(habit(), "2026-08-31"), false);
  });

  test("종료일 이후는 예정 아님", () => {
    const h = habit({ endDate: "2026-09-10" });
    assertTrue(isScheduled(h, "2026-09-10"));
    assertEqual(isScheduled(h, "2026-09-11"), false);
  });

  test("월수금 정책은 화요일에 예정 아님", () => {
    const h = habit({ policies: [makePolicy("2026-09-01", { repeat: { days: [1, 3, 5] } })] });
    assertTrue(isScheduled(h, "2026-09-07"));  // 월
    assertEqual(isScheduled(h, "2026-09-08"), false); // 화
    assertTrue(isScheduled(h, "2026-09-09"));  // 수
  });

  test("적용일 이력: 9/10부터 월수금으로 바꿔도 9/8(화)은 그대로 예정", () => {
    const policies = withPolicy([makePolicy("2026-09-01")], makePolicy("2026-09-10", { repeat: { days: [1, 3, 5] } }));
    const h = habit({ policies });
    assertTrue(isScheduled(h, "2026-09-08"));          // 화, 옛 정책
    assertEqual(isScheduled(h, "2026-09-15"), false);  // 화, 새 정책
    assertEqual(policyAt(h, "2026-09-09").effectiveFrom, "2026-09-01");
    assertEqual(policyAt(h, "2026-09-10").effectiveFrom, "2026-09-10");
  });

  test("paused 정책 기간은 예정 아님, 재개 후 다시 예정", () => {
    let policies = withPolicy([makePolicy("2026-09-01")], makePolicy("2026-09-10", { status: "paused" }));
    policies = withPolicy(policies, makePolicy("2026-09-15"));
    const h = habit({ policies });
    assertTrue(isScheduled(h, "2026-09-09"));
    assertEqual(isScheduled(h, "2026-09-12"), false);
    assertTrue(isScheduled(h, "2026-09-15"));
  });

  test("withPolicy는 같은 effectiveFrom을 교체하고 정렬한다", () => {
    const policies = withPolicy([makePolicy("2026-09-10"), makePolicy("2026-09-01")], makePolicy("2026-09-10", { targetCount: 3 }));
    assertDeepEqual(policies.map((p) => p.effectiveFrom), ["2026-09-01", "2026-09-10"]);
    assertEqual(policies[1].targetCount, 3);
  });

  test("삭제된 습관은 예정 아님, scheduledHabits는 order 정렬", () => {
    const habits = {
      a: habit({ id: "a", order: 2 }),
      b: habit({ id: "b", order: 1 }),
      c: habit({ id: "c", order: 0, deletedAt: "2026-09-05T00:00:00Z" }),
    };
    assertDeepEqual(scheduledHabits(habits, "2026-09-09").map((h) => h.id), ["b", "a"]);
  });
});

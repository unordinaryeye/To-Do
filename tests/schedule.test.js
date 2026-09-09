import { suite, assertEqual, assertDeepEqual, assertTrue } from "./harness.js";
import { policyAt, isScheduled, withPolicy, alignFirstPolicy, makePolicy, scheduledHabits } from "../src/domain/schedule.js";
import { isoWeekday, addDays, addMonths, monthKey } from "../src/utils/date.js";

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

  test("withPolicy는 같은 날짜를 교체하고 이후 날짜의 정책은 버린다", () => {
    const policies = withPolicy([makePolicy("2026-09-01"), makePolicy("2026-09-10"), makePolicy("2026-10-01", { repeat: { days: [6, 7] } })], makePolicy("2026-09-10", { targetCount: 3 }));
    assertDeepEqual(policies.map((p) => p.effectiveFrom), ["2026-09-01", "2026-09-10"]);
    assertEqual(policies[1].targetCount, 3);
  });

  test("미래 시작 습관을 더 이른 날짜로 고치면 옛 미래 정책이 되살아나지 않는다", () => {
    const old = [makePolicy("2026-10-01", { repeat: { days: [6, 7] } })];
    const h = habit({ startDate: "2026-09-25", policies: withPolicy(old, makePolicy("2026-09-25", { repeat: { days: [1] } })) });
    assertDeepEqual(policyAt(h, "2026-10-05").repeat.days, [1]);
    assertEqual(isScheduled(h, "2026-10-05"), true); // 월요일
  });

  test("alignFirstPolicy: 시작일을 앞당기면 첫 정책도 앞당겨 공백이 없다", () => {
    const policies = alignFirstPolicy([makePolicy("2026-09-05"), makePolicy("2026-09-09", { repeat: { days: [1] } })], "2026-09-01");
    assertEqual(policies[0].effectiveFrom, "2026-09-01");
    assertEqual(policies[1].effectiveFrom, "2026-09-09");
    const h = habit({ startDate: "2026-09-01", policies });
    assertTrue(isScheduled(h, "2026-09-03"));
    assertEqual(alignFirstPolicy(policies, "2026-09-03"), policies, "이미 더 이르면 그대로");
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

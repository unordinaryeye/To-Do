import { suite, assertEqual, assertDeepEqual } from "./harness.js";
import { repeatLabel, timeLabel, triggerLabel } from "../src/domain/format.js";
import { weekOf, daysOfMonth, formatMonthKR, formatDateDots, isValidTime, isValidDateKey } from "../src/utils/date.js";
import { monthlyStats, weeklyStats, greenLightStats } from "../src/domain/metrics.js";
import { makePolicy } from "../src/domain/schedule.js";
import { tagsInUse, habitsForDate } from "../src/state/selectors.js";
import { defaultData } from "../src/domain/migrate.js";

suite("format", (test) => {
  test("repeatLabel 축약", () => {
    assertEqual(repeatLabel([1, 2, 3, 4, 5, 6, 7]), "매일");
    assertEqual(repeatLabel([1, 2, 3, 4, 5]), "평일");
    assertEqual(repeatLabel([6, 7]), "주말");
    assertEqual(repeatLabel([5, 1, 3]), "월·수·금");
    assertEqual(repeatLabel([1, 3], { long: true }), "월요일, 수요일");
    assertEqual(repeatLabel([]), "–");
  });
  test("timeLabel / triggerLabel", () => {
    assertEqual(timeLabel("09:05", true), "09:05");
    assertEqual(timeLabel("09:05", false), "AM 9:05");
    assertEqual(timeLabel("13:30", false), "PM 1:30");
    assertEqual(timeLabel("00:10", false), "AM 12:10");
    assertEqual(triggerLabel(null), "–");
    assertEqual(triggerLabel({ type: "context", value: "출근길" }), "출근길");
    assertEqual(triggerLabel({ type: "time", value: "07:00" }), "07:00");
  });
});

suite("date: 주/월", (test) => {
  test("weekOf 월요일 시작", () => {
    assertDeepEqual(weekOf("2026-09-09", 1), ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13"]);
    assertEqual(weekOf("2026-09-13", 1)[0], "2026-09-07"); // 일요일도 같은 주
  });
  test("weekOf 일요일 시작", () => {
    assertEqual(weekOf("2026-09-09", 7)[0], "2026-09-06");
    assertEqual(weekOf("2026-09-06", 7)[0], "2026-09-06");
  });
  test("daysOfMonth와 포맷", () => {
    assertEqual(daysOfMonth("2026-02").length, 28);
    assertEqual(daysOfMonth("2028-02").length, 29);
    assertEqual(formatMonthKR("2026-09"), "2026년 9월");
    assertEqual(formatDateDots("2026-09-09"), "2026. 9. 9.");
    assertEqual(isValidTime("23:59"), true);
    assertEqual(isValidTime("24:00"), false);
    assertEqual(isValidDateKey("2026-9-9"), false);
  });
});

suite("metrics: monthlyStats", (test) => {
  const habit = (id, days) => ({ id, name: id, emoji: "✅", order: 0, startDate: "2026-09-01", endDate: null, deletedAt: null, policies: [makePolicy("2026-09-01", { repeat: { days } })] });
  test("예정일만 분모, 미래는 future, 예정 아님은 off", () => {
    const habits = { a: habit("a", [1, 2, 3, 4, 5, 6, 7]), m: habit("m", [1, 3, 5]) };
    const checks = { "2026-09-07": { a: 1, m: 1 }, "2026-09-08": { a: 1 } };
    const stats = monthlyStats(habits, checks, "2026-09", "2026-09-09");
    const m = stats.perHabit.find((r) => r.habit.id === "m");
    assertEqual(m.cells["2026-09-07"], "done");
    assertEqual(m.cells["2026-09-08"], "off");
    assertEqual(m.cells["2026-09-09"], "missed");
    assertEqual(m.cells["2026-09-10"], "off");    // 목: 예정 아님(미래여도 off가 우선)
    assertEqual(m.cells["2026-09-11"], "future"); // 금: 예정된 미래
    assertEqual(m.scheduled, 4); // 9/2(수) 9/4(금) 9/7(월) 9/9(수)
    assertEqual(m.done, 1);
    assertEqual(stats.greenDays, 2); // 9/7(a,m 완료), 9/8(a만 예정이고 완료)
  });
  test("기록 없는 지난 달은 pct null", () => {
    const stats = monthlyStats({ a: habit("a", [1]) }, {}, "2026-08", "2026-09-09");
    assertEqual(stats.pct, null);
    assertEqual(stats.perHabit.length, 0);
  });
});

suite("selectors: 태그 필터", (test) => {
  test("tagsInUse는 습관이 쓰는 태그만, habitsForDate는 태그로 거른다", () => {
    const data = defaultData("2026-09-09");
    const tags = tagsInUse(data, "2026-09-09").map((t) => t.id);
    assertDeepEqual(tags, ["morning", "health", "evening"]);
    assertDeepEqual(habitsForDate(data, "2026-09-09", "health").map((h) => h.id), ["r4"]);
    assertEqual(habitsForDate(data, "2026-09-09").length, 6);
  });
});

suite("metrics: weeklyStats / greenLightStats", (test) => {
  const habit = (id, days, over = {}) => ({ id, name: id, emoji: "✅", order: 0, startDate: "2026-09-01", endDate: null, deletedAt: null, policies: [makePolicy("2026-09-01", { repeat: { days } })], ...over });
  const week = ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13"];
  test("주간: 셀 상태와 요일별 달성률, 미래 제외", () => {
    const habits = { a: habit("a", [1, 2, 3, 4, 5, 6, 7]), m: habit("m", [1, 3, 5]) };
    const checks = { "2026-09-07": { a: 1, m: 1 }, "2026-09-08": { a: 1 } };
    const s = weeklyStats(habits, checks, week, "2026-09-09");
    const m = s.perHabit.find((r) => r.habit.id === "m");
    assertDeepEqual([m.cells["2026-09-07"], m.cells["2026-09-08"], m.cells["2026-09-09"], m.cells["2026-09-10"], m.cells["2026-09-11"]], ["done", "off", "missed", "off", "future"]);
    assertEqual(s.perDay[0].pct, 100);
    assertEqual(s.perDay[1].pct, 100); // 화: a만 예정
    assertEqual(s.perDay[2].pct, 0);
    assertEqual(s.perDay[3].future, true);
    assertEqual(s.greenDays, 2);
    assertEqual(s.pct, 60); // done 3 / scheduled 5 (월 a,m 화 a 수 a,m)
  });
  test("초록불: 날짜 상태와 최장 연속", () => {
    const habits = { a: habit("a", [1, 2, 3, 4, 5, 6, 7]) };
    const checks = { "2026-09-01": { a: 1 }, "2026-09-02": { a: 1 }, "2026-09-04": { a: 1 } };
    const g = greenLightStats(habits, checks, "2026-09", "2026-09-05");
    assertDeepEqual(g.days.slice(0, 5).map((d) => d.state), ["green", "green", "zero", "green", "zero"]);
    assertEqual(g.days[5].state, "future");
    assertEqual(g.greenDays, 3);
    assertEqual(g.longestStreak, 2);
  });
  test("초록불: 예정 없는 날은 none", () => {
    const habits = { m: habit("m", [1]) };
    const g = greenLightStats(habits, {}, "2026-09", "2026-09-09");
    assertEqual(g.days[0].state, "none"); // 9/1 화
    assertEqual(g.days[6].state, "zero"); // 9/7 월
  });
});

suite("metrics: 리뷰 반영(초록불 규칙, 끝낸 루틴)", (test) => {
  const habit = (id, days, over = {}) => ({ id, name: id, emoji: "✅", order: 0, startDate: "2026-09-01", endDate: null, deletedAt: null, policies: [makePolicy("2026-09-01", { repeat: { days } })], ...over });
  test("초록불 최장 연속은 예정 없는 날을 건너뛴다(현재 연속과 같은 규칙)", () => {
    const habits = { m: habit("m", [1, 3, 5]) };
    const checks = { "2026-09-02": { m: 1 }, "2026-09-04": { m: 1 }, "2026-09-07": { m: 1 } }; // 수 금 월 연속
    const g = greenLightStats(habits, checks, "2026-09", "2026-09-08");
    assertEqual(g.longestStreak, 3);
    assertEqual(monthlyStats(habits, checks, "2026-09", "2026-09-08").longestStreak, 3);
  });
  test("끝낸 루틴은 미래 주에 나타나지 않는다", () => {
    const habits = { e: habit("e", [1, 2, 3, 4, 5, 6, 7], { endDate: "2026-02-01" }) };
    const s = weeklyStats(habits, {}, ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"], "2026-09-09");
    assertEqual(s.perHabit.length, 0);
  });
});

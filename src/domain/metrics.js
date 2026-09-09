import { addDays, compareKeys, daysOfMonth } from "../utils/date.js";
import { isScheduled, scheduledHabits, policyAt } from "./schedule.js";

const MAX_LOOKBACK_DAYS = 3660;

function checkCount(checks, dateKey, habitId) {
  const value = (checks[dateKey] || {})[habitId];
  return typeof value === "number" ? value : value ? 1 : 0;
}

function target(habit, dateKey) {
  const policy = policyAt(habit, dateKey);
  return policy ? Math.max(1, policy.targetCount || 1) : 1;
}

export function isHabitDone(habit, checks, dateKey) {
  return checkCount(checks, dateKey, habit.id) >= target(habit, dateKey);
}

/** 그날의 예정 습관 상태. scheduled가 0이면 done/partial 모두 false, pct는 null. */
export function dayStatus(habits, checks, dateKey) {
  const scheduled = scheduledHabits(habits, dateKey);
  const doneCount = scheduled.filter((habit) => isHabitDone(habit, checks, dateKey)).length;
  return {
    scheduled: scheduled.length,
    done: doneCount,
    allDone: scheduled.length > 0 && doneCount === scheduled.length,
    pct: scheduled.length ? (doneCount / scheduled.length) * 100 : null,
  };
}

/** 예정 습관 + 그날 투두를 합산한 진행률. */
export function dayProgress(habits, checks, todos, dateKey) {
  const status = dayStatus(habits, checks, dateKey);
  const todoDone = todos.filter((t) => t.done).length;
  const total = status.scheduled + todos.length;
  const done = status.done + todoDone;
  return { done, total, pct: total ? (done / total) * 100 : 0 };
}

const earliestCheckCache = new WeakMap();

/** 기록이 하나도 없는 날 이전에는 달성한 날이 있을 수 없으므로 스트릭 탐색 하한으로 쓴다. */
function earliestCheckDate(checks) {
  if (earliestCheckCache.has(checks)) return earliestCheckCache.get(checks);
  const keys = Object.keys(checks);
  const min = keys.length ? keys.reduce((a, b) => (compareKeys(a, b) <= 0 ? a : b)) : null;
  earliestCheckCache.set(checks, min);
  return min;
}

/**
 * 전체 스트릭: 선택일부터 거꾸로 가며 "예정 습관을 모두 달성한 날"을 센다.
 * 예정 습관이 없는 날은 건너뛴다. 선택일 당일이 미달성이면 유예하고 전날부터 센다.
 */
export function globalStreak(habits, checks, anchorKey) {
  const floor = earliestCheckDate(checks);
  if (!floor || Object.keys(habits).length === 0) return 0;
  let streak = 0;
  let key = anchorKey;
  for (let i = 0; i < MAX_LOOKBACK_DAYS && compareKeys(key, floor) >= 0; i++) {
    const status = dayStatus(habits, checks, key);
    if (status.scheduled === 0) {
      key = addDays(key, -1);
      continue;
    }
    if (status.allDone) streak++;
    else if (i > 0) break;
    key = addDays(key, -1);
  }
  return streak;
}

/** 습관 하나의 스트릭: 예정된 날만 따라가며 연속 달성 수. 기준일 당일만 미완료 유예. */
export function habitStreak(habit, checks, anchorKey) {
  const floor = earliestCheckDate(checks);
  if (!floor) return 0;
  let streak = 0;
  let key = anchorKey;
  for (let i = 0; i < MAX_LOOKBACK_DAYS && compareKeys(key, habit.startDate) >= 0 && compareKeys(key, floor) >= 0; i++) {
    if (isScheduled(habit, key)) {
      if (isHabitDone(habit, checks, key)) streak++;
      else if (key !== anchorKey) break;
    }
    key = addDays(key, -1);
  }
  return streak;
}

/**
 * 월간 통계. 미래 날짜는 분모에서 뺀다.
 * cells[date] = 'done' | 'missed' | 'off'(예정 아님) | 'future'
 */
export function monthlyStats(habits, checks, month, todayKey) {
  const days = daysOfMonth(month);
  const perHabit = Object.values(habits)
    .filter((h) => !h.deletedAt)
    .sort((a, b) => a.order - b.order)
    .map((habit) => {
      const cells = {};
      let scheduled = 0;
      let done = 0;
      for (const day of days) {
        if (compareKeys(day, todayKey) > 0) cells[day] = "future";
        else if (!isScheduled(habit, day)) cells[day] = "off";
        else if (isHabitDone(habit, checks, day)) { cells[day] = "done"; scheduled++; done++; }
        else { cells[day] = "missed"; scheduled++; }
      }
      return { habit, cells, scheduled, done, pct: scheduled ? Math.round((done / scheduled) * 100) : null };
    })
    .filter((row) => row.scheduled > 0 || Object.values(row.cells).some((c) => c === "future"));

  const totals = perHabit.reduce((acc, row) => ({ scheduled: acc.scheduled + row.scheduled, done: acc.done + row.done }), { scheduled: 0, done: 0 });
  const pastDays = days.filter((day) => compareKeys(day, todayKey) <= 0);
  const green = pastDays.map((day) => dayStatus(habits, checks, day).allDone);
  return {
    month,
    days,
    perHabit,
    pct: totals.scheduled ? Math.round((totals.done / totals.scheduled) * 100) : null,
    greenDays: green.filter(Boolean).length,
    longestStreak: longestRun(green),
  };
}

function longestRun(flags) {
  let best = 0;
  let run = 0;
  for (const flag of flags) {
    run = flag ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

function cellState(habit, checks, day, todayKey) {
  if (compareKeys(day, todayKey) > 0) return "future";
  if (!isScheduled(habit, day)) return "off";
  return isHabitDone(habit, checks, day) ? "done" : "missed";
}

/** 주간 통계: 습관 × 7일 셀 + 요일별 달성률 */
export function weeklyStats(habits, checks, days, todayKey) {
  const perHabit = Object.values(habits)
    .filter((h) => !h.deletedAt)
    .sort((a, b) => a.order - b.order)
    .map((habit) => {
      const cells = Object.fromEntries(days.map((day) => [day, cellState(habit, checks, day, todayKey)]));
      const scheduled = Object.values(cells).filter((c) => c === "done" || c === "missed").length;
      const done = Object.values(cells).filter((c) => c === "done").length;
      return { habit, cells, scheduled, done };
    })
    .filter((row) => row.scheduled > 0 || Object.values(row.cells).some((c) => c === "future"));
  const perDay = days.map((day) => {
    const status = dayStatus(habits, checks, day);
    return { day, future: compareKeys(day, todayKey) > 0, pct: status.pct, allDone: status.allDone };
  });
  const totals = perHabit.reduce((acc, r) => ({ scheduled: acc.scheduled + r.scheduled, done: acc.done + r.done }), { scheduled: 0, done: 0 });
  return {
    days, perHabit, perDay,
    pct: totals.scheduled ? Math.round((totals.done / totals.scheduled) * 100) : null,
    greenDays: perDay.filter((d) => d.allDone).length,
  };
}

/** 초록불 캘린더: 날짜별 'green' | 'partial' | 'zero' | 'none' | 'future' */
export function greenLightStats(habits, checks, month, todayKey) {
  const days = daysOfMonth(month).map((day) => {
    if (compareKeys(day, todayKey) > 0) return { day, state: "future" };
    const status = dayStatus(habits, checks, day);
    if (status.scheduled === 0) return { day, state: "none" };
    if (status.allDone) return { day, state: "green" };
    return { day, state: status.done > 0 ? "partial" : "zero", pct: status.pct };
  });
  const green = days.filter((d) => d.state !== "future").map((d) => d.state === "green");
  return { month, days, greenDays: green.filter(Boolean).length, longestStreak: longestRun(green) };
}

/** 월간 투두 집계 */
export function monthlyTodoStats(todos, month) {
  const list = Object.values(todos).filter((t) => t.date.startsWith(month));
  const done = list.filter((t) => t.done).length;
  return { total: list.length, done, pct: list.length ? Math.round((done / list.length) * 100) : null };
}

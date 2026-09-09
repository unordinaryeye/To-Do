import { addDays, compareKeys } from "../utils/date.js";
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

/** 그날의 예정 습관 상태. scheduled가 0이면 done/partial 모두 false. */
export function dayStatus(habits, checks, dateKey) {
  const scheduled = scheduledHabits(habits, dateKey);
  const doneCount = scheduled.filter((habit) => isHabitDone(habit, checks, dateKey)).length;
  return {
    scheduled: scheduled.length,
    done: doneCount,
    allDone: scheduled.length > 0 && doneCount === scheduled.length,
    partial: doneCount > 0 && doneCount < scheduled.length,
  };
}

/** 현재 UI의 진행률: 예정 습관 + 그날 투두를 합산한다. */
export function dayProgress(habits, checks, todos, dateKey) {
  const status = dayStatus(habits, checks, dateKey);
  const todoDone = todos.filter((t) => t.done).length;
  const total = status.scheduled + todos.length;
  const done = status.done + todoDone;
  return { done, total, pct: total ? (done / total) * 100 : 0 };
}

function earliestStart(habits) {
  return Object.values(habits).reduce((min, habit) => (
    !min || compareKeys(habit.startDate, min) < 0 ? habit.startDate : min
  ), null);
}

/**
 * 전체 스트릭: 선택일부터 거꾸로 가며 "예정 습관을 모두 달성한 날"을 센다.
 * 예정 습관이 없는 날은 건너뛴다(끊기지도 늘지도 않음).
 * 선택일 자체가 미달성이면 그날은 건너뛰고 전날부터 센다(진행 중 유예).
 */
export function globalStreak(habits, checks, anchorKey) {
  const floor = earliestStart(habits);
  if (!floor) return 0;
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

/** 습관 하나의 스트릭: 예정된 날만 따라가며 연속 달성 수. */
export function habitStreak(habit, checks, anchorKey) {
  let streak = 0;
  let key = anchorKey;
  for (let i = 0; i < MAX_LOOKBACK_DAYS && compareKeys(key, habit.startDate) >= 0; i++) {
    if (isScheduled(habit, key)) {
      if (isHabitDone(habit, checks, key)) streak++;
      else if (key !== anchorKey) break; // 기준일 당일만 미완료 유예
    }
    key = addDays(key, -1);
  }
  return streak;
}

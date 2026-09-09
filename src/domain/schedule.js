import { isoWeekday, compareKeys } from "../utils/date.js";

/**
 * 날짜 d에 적용되는 정책. policies는 effectiveFrom 오름차순으로 저장되며
 * d 이전(또는 당일)에 시작한 것 중 가장 늦은 것을 고른다.
 */
export function policyAt(habit, dateKey) {
  let found = null;
  for (const policy of habit.policies) {
    if (compareKeys(policy.effectiveFrom, dateKey) <= 0) found = policy;
    else break;
  }
  return found;
}

/** 현재(오늘 기준) 정책. 폼과 목록 표시에 쓴다. */
export function currentPolicy(habit, todayKey) {
  return policyAt(habit, todayKey) || habit.policies[habit.policies.length - 1] || null;
}

export function isScheduled(habit, dateKey) {
  if (habit.deletedAt) return false;
  if (compareKeys(dateKey, habit.startDate) < 0) return false;
  if (habit.endDate && compareKeys(dateKey, habit.endDate) > 0) return false;
  const policy = policyAt(habit, dateKey);
  if (!policy || policy.status !== "active") return false;
  return policy.repeat.days.includes(isoWeekday(dateKey));
}

export function scheduledHabits(habits, dateKey) {
  return Object.values(habits)
    .filter((habit) => isScheduled(habit, dateKey))
    .sort((a, b) => a.order - b.order);
}

/** 정책 배열에 새 정책을 넣는다. 같은 effectiveFrom이면 교체. 항상 새 배열을 돌려준다. */
export function withPolicy(policies, policy) {
  const rest = policies.filter((p) => p.effectiveFrom !== policy.effectiveFrom);
  return [...rest, policy].sort((a, b) => compareKeys(a.effectiveFrom, b.effectiveFrom));
}

export function makePolicy(effectiveFrom, overrides = {}) {
  return {
    effectiveFrom,
    status: "active",
    repeat: { days: [1, 2, 3, 4, 5, 6, 7] },
    trigger: null,
    goalTagIds: [],
    targetCount: 1,
    ...overrides,
  };
}

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

/**
 * 정책 배열에 새 정책을 넣는다. 같은 날짜는 교체하고, 그 이후 날짜의 정책은 버린다
 * (새 설정이 "그날부터 계속"이라는 뜻이므로 예전에 예약해 둔 미래 정책이 되살아나면 안 된다).
 * 항상 새 배열을 돌려준다.
 */
export function withPolicy(policies, policy) {
  const kept = policies.filter((p) => compareKeys(p.effectiveFrom, policy.effectiveFrom) < 0);
  return [...kept, policy];
}

/** 시작일이 첫 정책보다 이르면 첫 정책을 시작일까지 내려 공백 구간을 없앤다. */
export function alignFirstPolicy(policies, startDate) {
  if (!policies.length || compareKeys(policies[0].effectiveFrom, startDate) <= 0) return policies;
  return [{ ...policies[0], effectiveFrom: startDate }, ...policies.slice(1)];
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

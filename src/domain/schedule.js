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

/** 날짜 이전(당일 포함)에 시작한 정책 중 가장 최근의 active 정책. 쉬어가기 재개 시 설정 복원에 쓴다. */
export function lastActivePolicy(habit, dateKey) {
  let found = null;
  for (const policy of habit.policies) {
    if (compareKeys(policy.effectiveFrom, dateKey) > 0) break;
    if (policy.status === "active") found = policy;
  }
  return found;
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

const byDate = (a, b) => compareKeys(a.effectiveFrom, b.effectiveFrom);
const SETTING_KEYS = ["repeat", "trigger", "goalTagIds", "targetCount"];
const settingsOf = (policy) => Object.fromEntries(SETTING_KEYS.map((k) => [k, policy[k]]));

/**
 * 정책 배열에 새 정책을 넣는다. 같은 날짜는 교체하고, 그 이후 날짜의 정책은 버린다
 * (새 설정이 "그날부터 계속"이라는 뜻이므로 예전에 예약해 둔 미래 정책이 되살아나면 안 된다).
 * 항상 새 배열을 돌려준다.
 */
export function withPolicy(policies, policy) {
  const kept = policies.filter((p) => compareKeys(p.effectiveFrom, policy.effectiveFrom) < 0);
  return [...kept, policy];
}

/**
 * 설정 변경: policy의 설정(반복·시간·태그·목표수)을 그날부터 적용하되, 이후 정책의 "상태"(쉬는 중/활성/재개 예약)는 유지한다.
 * 같은 날짜 정책은 교체하고, 이후 정책은 설정만 새 값으로 덮어쓴다.
 */
export function applySettingsFrom(policies, policy) {
  const settings = settingsOf(policy);
  const earlier = policies.filter((p) => compareKeys(p.effectiveFrom, policy.effectiveFrom) < 0);
  const later = policies.filter((p) => compareKeys(p.effectiveFrom, policy.effectiveFrom) > 0).map((p) => ({ ...p, ...settings }));
  return [...earlier, policy, ...later].sort(byDate);
}

/**
 * 쉬어가기: from부터 paused. until이 있으면 그 사이 정책은 paused로 바꾸고 다음 날 active로 재개한다.
 * until이 없으면 이후 정책을 모두 paused로 바꾼다(다시 시작할 때까지). 예약된 미래 정책의 설정은 보존된다.
 */
export function pausePolicies(policies, from, until, addDays) {
  const base = policies.filter((p) => compareKeys(p.effectiveFrom, from) <= 0).sort(byDate).at(-1) || policies.at(-1);
  const inPause = (p) => compareKeys(p.effectiveFrom, from) > 0 && (!until || compareKeys(p.effectiveFrom, until) <= 0);
  let next = policies.filter((p) => p.effectiveFrom !== from).map((p) => (inPause(p) ? { ...p, status: "paused" } : p));
  next.push({ ...base, effectiveFrom: from, status: "paused" });
  if (until) {
    const resumeDay = addDays(until, 1);
    if (!next.some((p) => p.effectiveFrom === resumeDay)) {
      const source = next.filter((p) => compareKeys(p.effectiveFrom, until) <= 0).sort(byDate).at(-1);
      next.push({ ...source, effectiveFrom: resumeDay, status: "active" });
    }
  }
  return next.sort(byDate);
}

/** 다시 시작: today부터 active, 이후 paused로 바뀌어 있던 정책도 active로. */
export function resumePolicies(policies, today) {
  const base = policies.filter((p) => compareKeys(p.effectiveFrom, today) <= 0).sort(byDate).at(-1) || policies.at(-1);
  const rest = policies.filter((p) => p.effectiveFrom !== today).map((p) => (compareKeys(p.effectiveFrom, today) > 0 ? { ...p, status: "active" } : p));
  return [...rest, { ...base, effectiveFrom: today, status: "active" }].sort(byDate);
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

// 날짜 키(YYYY-MM-DD)는 항상 기기 로컬 달력 기준으로 만든다.
export const DAYS_KR = ["일", "월", "화", "수", "목", "금", "토"];
/** ISO 요일(월=1 … 일=7) → 한글 */
export const ISO_DAYS_KR = { 1: "월", 2: "화", 3: "수", 4: "목", 5: "금", 6: "토", 7: "일" };

const pad2 = (n) => String(n).padStart(2, "0");

export function toDateKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function fromDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey() {
  return toDateKey(new Date());
}

export function addDays(key, n) {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

export function monthKey(dateKey) {
  return dateKey.slice(0, 7);
}

export function addMonths(monthKeyStr, n) {
  const [y, m] = monthKeyStr.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** 그 달의 모든 날짜 키 */
export function daysOfMonth(monthKeyStr) {
  const [y, m] = monthKeyStr.split("-").map(Number);
  const count = new Date(y, m, 0).getDate();
  return Array.from({ length: count }, (_, i) => `${monthKeyStr}-${pad2(i + 1)}`);
}

/** ISO 요일: 월=1 … 일=7 */
export function isoWeekday(key) {
  const day = fromDateKey(key).getDay();
  return day === 0 ? 7 : day;
}

/** 선택일이 속한 주(7일). weekStart는 ISO 요일(월=1, 일=7). */
export function weekOf(key, weekStart = 1) {
  const offset = (isoWeekday(key) - weekStart + 7) % 7;
  const start = addDays(key, -offset);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function formatKR(key) {
  const d = fromDateKey(key);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS_KR[d.getDay()]})`;
}

export function formatMonthKR(monthKeyStr) {
  const [y, m] = monthKeyStr.split("-").map(Number);
  return `${y}년 ${m}월`;
}

export function formatDateDots(key) {
  const [y, m, d] = key.split("-").map(Number);
  return `${y}. ${m}. ${d}.`;
}

export function formatBackupTime(iso) {
  if (!iso) return "백업한 적 없음";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 선택일 기준 앞뒤 3일, 총 7일 */
export function surroundingWeek(key) {
  return Array.from({ length: 7 }, (_, i) => addDays(key, i - 3));
}

export function compareKeys(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isValidDateKey(key) {
  return typeof key === "string" && /^\d{4}-\d{2}-\d{2}$/.test(key);
}

export function isValidTime(value) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

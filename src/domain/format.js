import { ISO_DAYS_KR } from "../utils/date.js";
import { ALL_WEEKDAYS } from "../config.js";

const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [6, 7];

const sortedNums = (arr) => [...arr].sort((x, y) => x - y);
const sameSet = (a, b) => {
  if (a.length !== b.length) return false;
  const sa = sortedNums(a);
  const sb = sortedNums(b);
  return sa.every((v, i) => v === sb[i]);
};

/** 반복 요일 → "매일" / "평일" / "주말" / "월·수·금" (short) 또는 "월요일, 수요일, 금요일" (long) */
export function repeatLabel(days, { long = false } = {}) {
  if (!days?.length) return long ? "반복 없음" : "–";
  if (sameSet(days, ALL_WEEKDAYS)) return "매일";
  if (sameSet(days, WEEKDAYS)) return "평일";
  if (sameSet(days, WEEKEND)) return "주말";
  const sorted = [...days].sort((a, b) => a - b);
  return long ? sorted.map((d) => `${ISO_DAYS_KR[d]}요일`).join(", ") : sorted.map((d) => ISO_DAYS_KR[d]).join("·");
}

/** "09:00" → clock24면 그대로, 아니면 "AM 9:00" */
export function timeLabel(time, clock24 = true) {
  if (!time) return "";
  if (clock24) return time;
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${suffix} ${hour12}:${String(m).padStart(2, "0")}`;
}

/** 트리거(시간/상황) → 표시 문자열. 없으면 "–" */
export function triggerLabel(trigger, clock24 = true) {
  if (!trigger || !trigger.type) return "–";
  if (trigger.type === "time") return timeLabel(trigger.value, clock24);
  return trigger.value || "–";
}

export const REPEAT_PRESETS = [
  { id: "daily", label: "매일", days: ALL_WEEKDAYS },
  { id: "weekdays", label: "평일", days: WEEKDAYS },
  { id: "weekend", label: "주말", days: WEEKEND },
];

export const TRIGGER_SUGGESTIONS = ["일어나자마자", "출근길", "점심 후", "퇴근 후", "자기 전"];

export const TIME_PRESETS = [
  { label: "아침", time: "07:00" },
  { label: "점심", time: "12:00" },
  { label: "저녁", time: "18:00" },
  { label: "밤", time: "21:00" },
];

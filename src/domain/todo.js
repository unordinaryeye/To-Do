/** 투두 도메인: 사분면(아이젠하워), 정렬, 빠른 입력 파싱 */

export const QUADRANTS = [
  { id: "q1", label: "지금 하기", icon: "🔥⭐", urgent: true, important: true, hint: "긴급하고 중요한 일" },
  { id: "q2", label: "계획하기", icon: "⭐", urgent: false, important: true, hint: "중요하지만 급하지 않은 일" },
  { id: "q3", label: "빨리 끝내기", icon: "🔥", urgent: true, important: false, hint: "급하지만 덜 중요한 일" },
  { id: "q4", label: "나중에", icon: "💤", urgent: false, important: false, hint: "정말 필요한지 다시 생각해 봐요" },
];

/** classified가 아니면 미분류. 레거시(false/false)는 분류한 적이 없으므로 Q4가 아니라 미분류다. */
export function quadrantOf(todo) {
  if (!todo.classified) return null;
  return QUADRANTS.find((q) => q.urgent === !!todo.urgent && q.important === !!todo.important) || null;
}

export function quadrantById(id) {
  return QUADRANTS.find((q) => q.id === id) || null;
}

export function quadrantRank(todo) {
  const q = quadrantOf(todo);
  return q ? QUADRANTS.indexOf(q) : QUADRANTS.length;
}

/** 표시 순서: 시간 있는 항목 시간순 → 시간 없는 항목은 사분면 순 → 수동 순서 */
export function compareTodos(a, b) {
  if (a.time && b.time) return a.time < b.time ? -1 : a.time > b.time ? 1 : a.order - b.order;
  if (a.time) return -1;
  if (b.time) return 1;
  const rank = quadrantRank(a) - quadrantRank(b);
  return rank !== 0 ? rank : a.order - b.order;
}

export function priorityBadges(todo) {
  if (!todo.classified) return "";
  return `${todo.urgent ? "🔥" : ""}${todo.important ? "⭐" : ""}`;
}

const TIME_PATTERNS = [
  // 14:00, 9:30
  { re: /^(\d{1,2}):(\d{2})\s+(.+)$/, build: (m) => ({ h: +m[1], min: +m[2], title: m[3] }) },
  // 오후 2시, 오전 9시 30분, 저녁 7시
  { re: /^(오전|오후|아침|저녁|밤|새벽)\s*(\d{1,2})시\s*(?:(\d{1,2})분)?\s+(.+)$/, build: (m) => ({ h: koreanHour(m[1], +m[2]), min: m[3] ? +m[3] : 0, title: m[4] }) },
  // 2pm, 9am, 2:30pm
  { re: /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s+(.+)$/i, build: (m) => ({ h: (+m[1] % 12) + (m[3].toLowerCase() === "pm" ? 12 : 0), min: m[2] ? +m[2] : 0, title: m[4] }) },
  // 14시, 9시 반
  { re: /^(\d{1,2})시\s*(반)?\s+(.+)$/, build: (m) => ({ h: +m[1], min: m[2] ? 30 : 0, title: m[3] }) },
];

function koreanHour(period, hour) {
  if (period === "오전" || period === "아침" || period === "새벽") return hour % 12;
  if (hour >= 12) return hour;
  return hour + 12;
}

/** "14:00 병원" → { title: "병원", time: "14:00" }. 시간이 없거나 잘못되면 time: null */
export function parseTodoInput(text) {
  const raw = text.trim();
  for (const { re, build } of TIME_PATTERNS) {
    const m = raw.match(re);
    if (!m) continue;
    const { h, min, title } = build(m);
    if (h > 23 || min > 59) break;
    return { title: title.trim(), time: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}` };
  }
  return { title: raw, time: null };
}

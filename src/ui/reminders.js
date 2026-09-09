import { todayKey } from "../utils/date.js";
import { habitsForDate } from "../state/selectors.js";
import { isHabitDone } from "../domain/metrics.js";
import { toast } from "./toast.js";

const TICK_MS = 30 * 1000;
/** 이보다 오래 지난 알림은 앱을 늦게 열었을 때 조용히 넘긴다. */
const LATE_WINDOW_MIN = 90;

const minutesOf = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * 앱이 열려 있을 때만 동작하는 알림. 30초마다 "오늘 예정 + 알림 켬 + 시간 도달 + 미완료" 습관을 찾아
 * 토스트와(허용된 경우) 시스템 알림을 띄운다. 같은 습관은 하루 한 번만. 여러 개가 한꺼번에 도달하면 하나로 묶는다.
 * 앱이 닫혀 있을 때의 알림은 푸시 서버가 필요해 지원하지 않는다.
 */
export function startReminders(getState) {
  const fired = new Set();
  let lastDay = todayKey();

  function due(today, now) {
    const { data } = getState();
    const list = [];
    for (const habit of habitsForDate(data, today)) {
      const r = habit.reminder;
      if (!r?.enabled || !r.time || minutesOf(r.time) > now) continue;
      const key = `${today}:${habit.id}`;
      if (fired.has(key)) continue;
      fired.add(key);
      if (isHabitDone(habit, data.checks, today)) continue;
      if (now - minutesOf(r.time) > LATE_WINDOW_MIN) continue; // 너무 지난 알림은 조용히 넘김
      list.push(habit);
    }
    return list;
  }

  function tick() {
    const today = todayKey();
    if (today !== lastDay) { fired.clear(); lastDay = today; }
    const now = new Date();
    const habits = due(today, now.getHours() * 60 + now.getMinutes());
    if (habits.length) notify(habits);
  }

  function notify(habits) {
    const names = habits.map((h) => `${h.emoji} ${h.name}`);
    const body = habits.length === 1 ? `${names[0]} 할 시간이에요` : `${habits.length}개 루틴 할 시간이에요: ${names.join(", ")}`;
    toast("🔔", body);
    if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
      try { new Notification("Daily Routine", { body, tag: "reminder" }); } catch { /* iOS 등 미지원 */ }
    }
  }

  tick();
  const timer = setInterval(tick, TICK_MS);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") tick(); });
  return () => clearInterval(timer);
}

/** 알림 토글을 켤 때(사용자 탭 안에서) 한 번 권한을 묻는다. 거부돼도 앱 내 토스트는 동작한다. */
export async function requestNotificationPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try { return await Notification.requestPermission(); } catch { return "denied"; }
}

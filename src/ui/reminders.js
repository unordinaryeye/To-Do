import { todayKey } from "../utils/date.js";
import { habitsForDate } from "../state/selectors.js";
import { isHabitDone } from "../domain/metrics.js";
import { toast } from "./toast.js";

const TICK_MS = 30 * 1000;

/**
 * 앱이 열려 있을 때만 동작하는 알림. 매 30초마다 "오늘 예정 + 알림 켬 + 시간 도달 + 미완료" 습관을 찾아
 * 토스트와(허용된 경우) 시스템 알림을 띄운다. 같은 습관은 하루 한 번만.
 * 앱이 닫혀 있을 때의 알림은 푸시 서버가 필요해 지원하지 않는다.
 */
export function startReminders(getState) {
  const fired = new Set();
  let lastDay = todayKey();

  function tick() {
    const today = todayKey();
    if (today !== lastDay) { fired.clear(); lastDay = today; }
    const now = new Date().toTimeString().slice(0, 5);
    const { data } = getState();
    for (const habit of habitsForDate(data, today)) {
      const r = habit.reminder;
      if (!r?.enabled || !r.time || r.time > now) continue;
      const key = `${today}:${habit.id}`;
      if (fired.has(key) || isHabitDone(habit, data.checks, today)) continue;
      fired.add(key);
      notify(habit);
    }
  }

  function notify(habit) {
    toast("🔔", `${habit.emoji} ${habit.name} 할 시간이에요`);
    if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
      try { new Notification("Daily Routine", { body: `${habit.emoji} ${habit.name} 할 시간이에요`, tag: habit.id }); } catch { /* iOS 등 미지원 */ }
    }
  }

  tick();
  const timer = setInterval(tick, TICK_MS);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") tick(); });
  return () => clearInterval(timer);
}

/** 알림 토글을 켤 때 한 번 권한을 묻는다. 거부돼도 앱 내 토스트는 동작한다. */
export async function requestNotificationPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try { return await Notification.requestPermission(); } catch { return "denied"; }
}

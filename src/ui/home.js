import { h } from "../utils/dom.js";
import { ISO_DAYS_KR, weekOf, isoWeekday, fromDateKey, formatMonthKR, monthKey, todayKey } from "../utils/date.js";
import { habitsForDate, todosForDate, tagsInUse, activeHabits, checkProgress } from "../state/selectors.js";
import { dayStatus, dayProgress, globalStreak, habitStreak, isHabitDone } from "../domain/metrics.js";
import { currentPolicy } from "../domain/schedule.js";
import { repeatLabel, triggerLabel } from "../domain/format.js";
import { needsBackupReminder } from "../storage/local.js";
import { chip, emptyState } from "./parts.js";
import { renderHabitWeek } from "./week.js";
import { renderTodosTab } from "./todo.js";

const SWIPE_MIN_PX = 40;

function header(state) {
  const { selectedDate } = state.ui;
  const streak = globalStreak(state.data.habits, state.data.checks, todayKey());
  return h("div", { class: "home-head" },
    h("button", { class: "month-btn", dataset: { action: "goToday" }, title: "오늘로 이동" }, formatMonthKR(monthKey(selectedDate))),
    h("div", { class: "head-right" },
      h("div", { class: `streak-badge${streak > 0 ? " hot" : ""}`, "aria-label": `연속 ${streak}일` }, "🔥", String(streak)),
      h("button", { class: "icon-btn", dataset: { action: "openReorder" }, "aria-label": "순서변경" }, "↕"),
      h("button", { class: "icon-btn", dataset: { action: "openSettingsRoute" }, "aria-label": "설정" }, "⋯"),
    ),
  );
}

function donut(status, dayNum) {
  const pct = status.pct;
  const cls = ["donut", status.allDone && "green", pct == null && "none"].filter(Boolean).join(" ");
  const style = pct != null && !status.allDone
    ? { background: `conic-gradient(var(--yellow) ${pct}%, var(--line) 0)` }
    : undefined;
  return h("div", { class: cls, style, "aria-label": pct == null ? "예정 없음" : `${Math.round(pct)}%` },
    h("span", { class: "num" }, String(dayNum)));
}

/** 좌우 스와이프로 주 이동. 핸들러는 이벤트 위임과 별개로 이 노드에만 붙인다. */
function attachSwipe(node) {
  let startX = null;
  node.addEventListener("pointerdown", (e) => { startX = e.clientX; }, { passive: true });
  node.addEventListener("pointerup", (e) => {
    if (startX == null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) < SWIPE_MIN_PX) return;
    node.querySelector(`[data-action="moveDate"][data-n="${dx < 0 ? 7 : -7}"]`)?.click();
  });
  return node;
}

function weekStrip(state) {
  const { selectedDate } = state.ui;
  const { habits, checks, settings } = state.data;
  const today = todayKey();
  const days = weekOf(selectedDate, settings.weekStart ?? 1).map((key) => {
    const status = dayStatus(habits, checks, key);
    const cls = ["week-day", key === selectedDate && "selected", key === today && "today"].filter(Boolean).join(" ");
    return h("button", { class: cls, dataset: { action: "selectDate", date: key }, "aria-pressed": String(key === selectedDate) },
      h("span", { class: "lbl" }, ISO_DAYS_KR[isoWeekday(key)]),
      donut(status, fromDateKey(key).getDate()),
    );
  });
  return attachSwipe(h("div", { class: "week-strip" },
    h("button", { class: "arrow", dataset: { action: "moveDate", n: "-7" }, "aria-label": "지난주" }, "‹"),
    h("div", { class: "week-days" }, days),
    h("button", { class: "arrow", dataset: { action: "moveDate", n: "7" }, "aria-label": "다음주" }, "›"),
  ));
}

function segment(tab) {
  const btn = (id, label) => h("button", { class: `seg-btn${tab === id ? " active" : ""}`, dataset: { action: "setHomeTab", tab: id }, "aria-pressed": String(tab === id) }, label);
  return h("div", { class: "segment", role: "tablist" }, btn("habits", "루틴"), btn("todos", "투두"));
}

function filterRow(state) {
  const tags = tagsInUse(state.data, todayKey());
  return h("div", { class: "filter-row" },
    chip(state.ui.homeRange === "week" ? "주 ▾" : "하루 ▾", { dark: true, dataset: { action: "toggleHomeRange" } }),
    tags.map((tag) => chip(`${tag.emoji} ${tag.name}`, {
      on: state.ui.filterTagId === tag.id,
      dataset: { action: "toggleFilterTag", id: tag.id },
    })),
    h("button", { class: "chip sm tag-manage", dataset: { action: "openTagManage" }, "aria-label": "목표 태그 관리" }, tags.length ? "⚙" : "+ 목표"),
  );
}

function checkCell(done, label, dataset, extraClass = "") {
  return h("div", {
    class: `cell check${extraClass}${done ? " on check-pop" : ""}`,
    dataset, role: "checkbox", tabindex: "0", "aria-checked": String(done), "aria-label": label,
  });
}

function whenCell(policy, clock24, dataset) {
  const trigger = policy?.trigger;
  return h("div", { class: "cell when", dataset, role: "button", tabindex: "0", "aria-label": "시간과 반복 요일 설정" },
    h("span", { class: `t${trigger?.type === "context" ? " ctx" : ""}` }, triggerLabel(trigger, clock24)),
    h("span", { class: "d" }, repeatLabel(policy?.repeat.days)),
  );
}

function habitRow(habit, index, state) {
  const { selectedDate } = state.ui;
  const { checks, settings } = state.data;
  const done = isHabitDone(habit, checks, selectedDate);
  const policy = currentPolicy(habit, selectedDate);
  const streak = habitStreak(habit, checks, selectedDate);
  const check = checkCell(done, habit.name, { action: "toggleCheck", id: habit.id });
  const { count, target } = checkProgress(state.data, habit, selectedDate);
  check.textContent = done ? habit.emoji : "";
  if (!done && count > 0) { check.classList.add("partial"); check.textContent = `${count}/${target}`; }
  else if (done && target > 1) check.append(h("span", { class: "count-badge" }, `${count}/${target}`));
  return h("div", { class: "row", dataset: { habitId: habit.id } },
    check,
    whenCell(policy, settings.clock24, { action: "openSchedule", id: habit.id }),
    h("div", { class: "cell name", dataset: { action: "openHabitActions", id: habit.id }, role: "button", tabindex: "0" },
      h("span", { class: "rank" }, String(index + 1)),
      h("span", { class: "txt" }, `${habit.emoji} ${habit.name}`),
      streak > 0 ? h("span", { class: "fire hot", "aria-label": `연속 ${streak}회` }, `🔥${streak}`) : null,
    ),
  );
}

function habitsTab(state) {
  const { selectedDate, filterTagId } = state.ui;
  const habits = habitsForDate(state.data, selectedDate, filterTagId);
  const hasAny = activeHabits(state.data).length > 0;
  if (!habits.length) {
    return hasAny
      ? emptyState("🛌", "오늘은 예정된 루틴이 없어요", filterTagId ? "필터를 해제해 보세요" : "투두 탭을 확인해 볼까요?")
      : emptyState("🌱", "첫 번째 루틴을 만들어 보세요", "오른쪽 아래 + 버튼을 눌러요");
  }
  return h("div", { class: "table" }, habits.map((habit, i) => habitRow(habit, i, state)));
}

function completeBanner(state) {
  const { selectedDate } = state.ui;
  const { habits, checks } = state.data;
  const progress = dayProgress(habits, checks, todosForDate(state.data, selectedDate), selectedDate);
  if (progress.total === 0 || progress.pct < 100) return null;
  return h("div", { class: "complete-banner fade-in" },
    h("div", { class: "big-emoji" }, "🎉"),
    h("p", { class: "complete-main" }, "오늘 할 일 모두 완료!"),
    h("p", { class: "complete-sub" }, "대단해요, 꾸준함이 실력입니다"),
  );
}

export function renderHome(state, drafts) {
  const tab = state.ui.homeTab;
  return h("div", { class: "screen fade-in" },
    header(state),
    weekStrip(state),
    needsBackupReminder(state.data, state.ui.syncCode) ? h("div", { class: "backup-banner", dataset: { action: "goRoute", route: "settings" }, role: "button", tabindex: "0" },
      h("span", { class: "big-emoji sm" }, "💾"),
      h("div", null, h("div", { class: "banner-main" }, "데이터 백업을 해두면 안전해요"), h("div", { class: "banner-sub" }, "탭해서 백업하기 →")),
    ) : null,
    segment(tab),
    h("div", { class: "home-body" },
      tab === "habits" ? filterRow(state) : null,
      tab === "habits" ? (state.ui.homeRange === "week" ? renderHabitWeek(state) : habitsTab(state)) : renderTodosTab(state, drafts),
      completeBanner(state),
    ),
  );
}

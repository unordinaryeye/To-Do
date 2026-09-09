import { h } from "../utils/dom.js";
import { todayKey } from "../utils/date.js";
import { activeHabits } from "../state/selectors.js";
import { currentPolicy } from "../domain/schedule.js";
import { repeatLabel, triggerLabel } from "../domain/format.js";
import { page, moveButtons } from "./parts.js";

/**
 * 드래그 중에는 store를 건드리지 않고 DOM 순서만 바꾼다(재렌더가 드래그 대상 노드를 갈아치우면 안 되므로).
 * 손을 떼면 그때 DOM 순서를 읽어 한 번만 dispatch한다.
 */
function attachDrag(list, onCommit) {
  let dragging = null;
  let offsetY = 0;

  list.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest(".handle");
    if (!handle) return;
    dragging = handle.closest(".reorder-row");
    offsetY = event.clientY - dragging.getBoundingClientRect().top;
    dragging.classList.add("dragging");
    dragging.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });

  /** 포인터 위치에 맞을 때까지 한 칸씩 옮긴다(빠른 드래그로 여러 행을 건너뛰어도 한 번의 move로 따라잡는다). */
  function settle(y) {
    for (let guard = 0; guard < 50; guard++) {
      let moved = false;
      for (const row of list.querySelectorAll(".reorder-row")) {
        if (row === dragging) continue;
        const rect = row.getBoundingClientRect();
        const middle = rect.top + rect.height / 2;
        const draggingAfter = row.compareDocumentPosition(dragging) & Node.DOCUMENT_POSITION_FOLLOWING;
        if (y < middle && draggingAfter) { list.insertBefore(dragging, row); moved = true; break; }
        if (y > middle && !draggingAfter) { list.insertBefore(dragging, row.nextSibling); moved = true; break; }
      }
      if (!moved) return;
    }
  }
  list.addEventListener("pointermove", (event) => { if (dragging) settle(event.clientY); });

  const finish = () => {
    if (!dragging) return;
    dragging.classList.remove("dragging");
    dragging = null;
    onCommit([...list.querySelectorAll(".reorder-row")].map((row) => row.dataset.id));
  };
  list.addEventListener("pointerup", finish);
  list.addEventListener("pointercancel", finish);
  return list;
}

function row(habit, index, total, today, clock24) {
  const policy = currentPolicy(habit, today);
  return h("div", { class: "reorder-row", dataset: { id: habit.id } },
    h("span", { class: "rank" }, String(index + 1)),
    h("div", null,
      h("div", { class: "name" }, `${habit.emoji} ${habit.name}`),
      h("div", { class: "card-meta", style: { marginTop: "2px" } }, `${triggerLabel(policy?.trigger, clock24)} · ${repeatLabel(policy?.repeat.days)}`),
    ),
    moveButtons("moveHabitAll", habit.id, { isFirst: index === 0, isLast: index === total - 1 }),
    h("span", { class: "handle", "aria-label": "드래그해서 순서 바꾸기" }, "≡"),
  );
}

export function renderReorder(state, _drafts, actions) {
  const today = todayKey();
  const habits = activeHabits(state.data);
  const list = h("div", { class: "reorder-list" }, habits.map((habit, i) => row(habit, i, habits.length, today, state.data.settings.clock24)));
  attachDrag(list, (ids) => actions?.reorderHabits(ids));
  return page("순서변경", {},
    h("p", { class: "card-meta", style: { margin: "4px 0 14px" } }, "≡를 잡고 끌거나 ▲▼로 순서를 바꿔요. 바뀐 순서는 바로 저장돼요."),
    list,
  );
}

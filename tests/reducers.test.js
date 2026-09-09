import { suite, assertEqual, assertDeepEqual, assertTrue } from "./harness.js";
import { rootReducer, A, initialUi } from "../src/state/reducers.js";
import { createStore } from "../src/state/store.js";
import { defaultData } from "../src/domain/migrate.js";
import { todosForDate, activeHabits, habitsForDate } from "../src/state/selectors.js";
import { policyAt } from "../src/domain/schedule.js";

const TODAY = "2026-09-09";

function freshState() {
  return { data: defaultData(TODAY), ui: initialUi({ today: TODAY, syncCode: "", firebaseReady: false }) };
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

const newHabit = (over = {}) => ({
  type: A.HABIT_UPSERT, id: null, name: "새 습관", emoji: "🎯", startDate: TODAY, endDate: null,
  repeatDays: [1, 3, 5], trigger: { type: "time", value: "09:00" }, today: TODAY, ...over,
});

suite("reducers: 불변성", (test) => {
  test("모든 액션이 이전 상태를 변경하지 않는다(deepFreeze)", () => {
    const state = deepFreeze(freshState());
    const actions = [
      { type: A.CHECK_TOGGLE, date: TODAY, habitId: "r1" },
      newHabit(),
      { type: A.HABIT_RENAME, id: "r1", name: "바꿈" },
      { type: A.HABIT_MOVE, id: "r2", dir: -1 },
      { type: A.HABIT_DELETE, id: "r6" },
      { type: A.TODO_UPSERT, id: null, title: "할 일", date: TODAY, time: "10:00" },
      { type: A.SETTINGS_SET, patch: { weekStart: 7 } },
      { type: A.UI_SET, patch: { route: "stats" } },
    ];
    let current = state;
    for (const action of actions) current = deepFreeze(rootReducer(current, action));
    assertTrue(current !== state, "상태가 바뀌어야 함");
  });

  test("변화가 없으면 같은 참조를 돌려준다", () => {
    const state = freshState();
    assertEqual(rootReducer(state, { type: A.HABIT_RENAME, id: "r1", name: state.data.habits.r1.name }), state);
    assertEqual(rootReducer(state, { type: A.HABIT_DELETE, id: "없음" }), state);
    assertEqual(rootReducer(state, { type: A.HABIT_MOVE, id: "r1", dir: -1 }), state);
  });
});

suite("reducers: 습관 upsert", (test) => {
  test("새 습관: 시작일부터 적용되는 정책 1개, 반복·트리거 저장", () => {
    const state = rootReducer(freshState(), newHabit());
    const added = Object.values(state.data.habits).find((h) => h.name === "새 습관");
    assertEqual(added.order, 6);
    assertEqual(added.startDate, TODAY);
    assertEqual(added.policies.length, 1);
    assertDeepEqual(added.policies[0].repeat.days, [1, 3, 5]);
    assertDeepEqual(added.policies[0].trigger, { type: "time", value: "09:00" });
    assertEqual(added.policies[0].effectiveFrom, TODAY);
  });

  test("기존 습관 수정: 오늘부터 새 정책, 과거 정책은 유지", () => {
    let state = freshState();
    state = rootReducer(state, newHabit({ id: "r1", name: "물", emoji: "💧", startDate: "2000-01-01", repeatDays: [6, 7], trigger: null }));
    const habit = state.data.habits.r1;
    assertEqual(habit.policies.length, 2);
    assertDeepEqual(policyAt(habit, "2026-09-08").repeat.days, [1, 2, 3, 4, 5, 6, 7]);
    assertDeepEqual(policyAt(habit, TODAY).repeat.days, [6, 7]);
    assertEqual(habit.order, 0, "order 유지");
    assertDeepEqual(policyAt(habit, TODAY).goalTagIds, ["morning"], "태그 유지");
  });

  test("같은 날 두 번 수정하면 정책이 늘지 않고 교체된다", () => {
    let state = freshState();
    state = rootReducer(state, newHabit({ id: "r1", name: "물", emoji: "💧", startDate: "2000-01-01", repeatDays: [1] }));
    state = rootReducer(state, newHabit({ id: "r1", name: "물", emoji: "💧", startDate: "2000-01-01", repeatDays: [2] }));
    assertEqual(state.data.habits.r1.policies.length, 2);
    assertDeepEqual(policyAt(state.data.habits.r1, TODAY).repeat.days, [2]);
  });

  test("종료일을 지정하면 그 이후엔 예정되지 않는다", () => {
    let state = freshState();
    state = rootReducer(state, newHabit({ id: "r1", name: "물", emoji: "💧", startDate: "2000-01-01", endDate: "2026-09-10", repeatDays: [1, 2, 3, 4, 5, 6, 7] }));
    assertTrue(habitsForDate(state.data, "2026-09-10").some((h) => h.id === "r1"));
    assertEqual(habitsForDate(state.data, "2026-09-11").some((h) => h.id === "r1"), false);
  });

  test("이동은 전체 순서에서 이웃과 바꾼다", () => {
    const state = rootReducer(freshState(), { type: A.HABIT_MOVE, id: "r4", dir: -1 });
    assertDeepEqual(activeHabits(state.data).slice(0, 4).map((h) => h.id), ["r1", "r2", "r4", "r3"]);
    assertEqual(rootReducer(state, { type: A.HABIT_MOVE, id: "r1", dir: -1 }), state);
  });
});

suite("reducers: 체크 / 투두 / 설정", (test) => {
  test("체크 토글은 1 ↔ 제거, 빈 날짜는 키 삭제", () => {
    let state = freshState();
    state = rootReducer(state, { type: A.CHECK_TOGGLE, date: TODAY, habitId: "r1" });
    assertDeepEqual(state.data.checks[TODAY], { r1: 1 });
    state = rootReducer(state, { type: A.CHECK_TOGGLE, date: TODAY, habitId: "r1" });
    assertEqual(TODAY in state.data.checks, false);
  });

  test("투두 추가/시간순 정렬/토글/삭제", () => {
    let state = freshState();
    state = rootReducer(state, { type: A.TODO_UPSERT, id: null, title: "늦게", date: TODAY, time: "18:00" });
    state = rootReducer(state, { type: A.TODO_UPSERT, id: null, title: "시간없음", date: TODAY, time: null });
    state = rootReducer(state, { type: A.TODO_UPSERT, id: null, title: "일찍", date: TODAY, time: "09:00" });
    let list = todosForDate(state.data, TODAY);
    assertDeepEqual(list.map((t) => t.title), ["일찍", "늦게", "시간없음"]);
    state = rootReducer(state, { type: A.TODO_TOGGLE, id: list[0].id });
    assertEqual(todosForDate(state.data, TODAY)[0].done, true);
    state = rootReducer(state, { type: A.TODO_DELETE, id: list[0].id });
    assertEqual(todosForDate(state.data, TODAY).length, 2);
  });

  test("투두 수정: 날짜를 바꾸면 새 날짜의 맨 뒤로", () => {
    let state = freshState();
    state = rootReducer(state, { type: A.TODO_UPSERT, id: null, title: "a", date: TODAY, time: null });
    state = rootReducer(state, { type: A.TODO_UPSERT, id: null, title: "b", date: "2026-09-10", time: null });
    const a = todosForDate(state.data, TODAY)[0];
    state = rootReducer(state, { type: A.TODO_UPSERT, id: a.id, title: "a2", date: "2026-09-10", time: "08:00" });
    const moved = todosForDate(state.data, "2026-09-10");
    assertDeepEqual(moved.map((t) => t.title), ["a2", "b"]); // 시간 있는 항목 우선
    assertEqual(moved[0].order, 1);
    assertEqual(todosForDate(state.data, TODAY).length, 0);
  });

  test("중간 삭제 후 추가해도 order가 겹치지 않아 이동이 된다", () => {
    let state = freshState();
    for (const title of ["a", "b", "c"]) state = rootReducer(state, { type: A.TODO_UPSERT, id: null, title, date: TODAY, time: null });
    const b = todosForDate(state.data, TODAY)[1];
    state = rootReducer(state, { type: A.TODO_DELETE, id: b.id });
    state = rootReducer(state, { type: A.TODO_UPSERT, id: null, title: "d", date: TODAY, time: null });
    const d = todosForDate(state.data, TODAY)[2];
    state = rootReducer(state, { type: A.TODO_MOVE, id: d.id, dir: -1 });
    assertDeepEqual(todosForDate(state.data, TODAY).map((t) => t.title), ["a", "d", "c"]);
  });

  test("설정 패치와 원격 패치는 슬라이스 단위", () => {
    const state = freshState();
    const s1 = rootReducer(state, { type: A.SETTINGS_SET, patch: { weekStart: 7 } });
    assertEqual(s1.data.settings.weekStart, 7);
    assertEqual(s1.data.settings.clock24, true);
    const s2 = rootReducer(state, { type: A.DATA_APPLY_REMOTE, patch: { checks: { [TODAY]: { r1: 1 } } } });
    assertEqual(s2.data.habits, state.data.habits);
  });
});

suite("store", (test) => {
  test("변화 없는 dispatch는 구독자를 부르지 않는다", () => {
    const store = createStore(rootReducer, freshState());
    let calls = 0;
    store.subscribe(() => calls++);
    store.dispatch({ type: A.HABIT_DELETE, id: "없음" });
    assertEqual(calls, 0);
    store.dispatch({ type: A.UI_SET, patch: { route: "stats" } });
    assertEqual(calls, 1);
  });
});

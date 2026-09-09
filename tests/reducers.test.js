import { suite, assertEqual, assertDeepEqual, assertTrue } from "./harness.js";
import { rootReducer, A, initialUi } from "../src/state/reducers.js";
import { createStore } from "../src/state/store.js";
import { defaultData } from "../src/domain/migrate.js";
import { todosForDate, groupedAll } from "../src/state/selectors.js";

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

suite("reducers: 불변성", (test) => {
  test("모든 액션이 이전 상태를 변경하지 않는다(deepFreeze)", () => {
    const state = deepFreeze(freshState());
    const actions = [
      { type: A.CHECK_TOGGLE, date: TODAY, habitId: "r1" },
      { type: A.HABIT_ADD, name: "새 습관", emoji: "🎯", category: "work", today: TODAY },
      { type: A.HABIT_RENAME, id: "r1", name: "바꿈" },
      { type: A.HABIT_MOVE, id: "r2", dir: -1 },
      { type: A.HABIT_DELETE, id: "r6" },
      { type: A.TODO_ADD, title: "할 일", date: TODAY },
      { type: A.UI_SET, patch: { view: "routines" } },
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

suite("reducers: 체크 / 습관 / 투두", (test) => {
  test("체크 토글은 1 ↔ 제거, 빈 날짜는 키 삭제", () => {
    let state = freshState();
    state = rootReducer(state, { type: A.CHECK_TOGGLE, date: TODAY, habitId: "r1" });
    assertDeepEqual(state.data.checks[TODAY], { r1: 1 });
    state = rootReducer(state, { type: A.CHECK_TOGGLE, date: TODAY, habitId: "r1" });
    assertEqual(TODAY in state.data.checks, false);
  });

  test("습관 추가는 마지막 order + 1, 정책은 오늘부터 매일", () => {
    const state = rootReducer(freshState(), { type: A.HABIT_ADD, name: "n", emoji: "🎯", category: "work", today: TODAY });
    const added = Object.values(state.data.habits).find((h) => h.name === "n");
    assertEqual(added.order, 6);
    assertEqual(added.startDate, TODAY);
    assertEqual(added.legacyCategory, "work");
    assertDeepEqual(added.policies[0].goalTagIds, ["work"]);
  });

  test("이동은 같은 카테고리 안에서만 order를 바꾼다", () => {
    const state = rootReducer(freshState(), { type: A.HABIT_MOVE, id: "r2", dir: -1 });
    const morning = groupedAll(state.data).find((g) => g.id === "morning").items.map((h) => h.id);
    assertDeepEqual(morning, ["r2", "r1", "r3"]);
    // r4(health)는 그룹의 유일한 항목이라 이동 불가
    assertEqual(rootReducer(state, { type: A.HABIT_MOVE, id: "r4", dir: 1 }), state);
  });

  test("투두 추가/토글/이동/삭제", () => {
    let state = freshState();
    state = rootReducer(state, { type: A.TODO_ADD, title: "a", date: TODAY });
    state = rootReducer(state, { type: A.TODO_ADD, title: "b", date: TODAY });
    let list = todosForDate(state.data, TODAY);
    assertDeepEqual(list.map((t) => t.title), ["a", "b"]);
    state = rootReducer(state, { type: A.TODO_MOVE, id: list[1].id, dir: -1 });
    list = todosForDate(state.data, TODAY);
    assertDeepEqual(list.map((t) => t.title), ["b", "a"]);
    state = rootReducer(state, { type: A.TODO_TOGGLE, id: list[0].id });
    assertEqual(todosForDate(state.data, TODAY)[0].done, true);
    state = rootReducer(state, { type: A.TODO_DELETE, id: list[0].id });
    assertEqual(todosForDate(state.data, TODAY).length, 1);
  });

  test("중간 삭제 후 추가해도 order가 겹치지 않아 이동이 된다", () => {
    let state = freshState();
    for (const title of ["a", "b", "c"]) state = rootReducer(state, { type: A.TODO_ADD, title, date: TODAY });
    const b = todosForDate(state.data, TODAY)[1];
    state = rootReducer(state, { type: A.TODO_DELETE, id: b.id });
    state = rootReducer(state, { type: A.TODO_ADD, title: "d", date: TODAY });
    const d = todosForDate(state.data, TODAY)[2];
    assertEqual(d.order, 3);
    state = rootReducer(state, { type: A.TODO_MOVE, id: d.id, dir: -1 });
    assertDeepEqual(todosForDate(state.data, TODAY).map((t) => t.title), ["a", "d", "c"]);
  });

  test("원격 패치는 슬라이스 단위로 덮어쓴다", () => {
    const state = freshState();
    const next = rootReducer(state, { type: A.DATA_APPLY_REMOTE, patch: { checks: { [TODAY]: { r1: 1 } } } });
    assertDeepEqual(next.data.checks, { [TODAY]: { r1: 1 } });
    assertEqual(next.data.habits, state.data.habits);
  });
});

suite("store", (test) => {
  test("변화 없는 dispatch는 구독자를 부르지 않는다", () => {
    const store = createStore(rootReducer, freshState());
    let calls = 0;
    store.subscribe(() => calls++);
    store.dispatch({ type: A.HABIT_DELETE, id: "없음" });
    assertEqual(calls, 0);
    store.dispatch({ type: A.UI_SET, patch: { view: "routines" } });
    assertEqual(calls, 1);
    assertEqual(store.getState().ui.view, "routines");
  });
});

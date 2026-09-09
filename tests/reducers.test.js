import { suite, assertEqual, assertDeepEqual, assertTrue } from "./harness.js";
import { rootReducer, A, initialUi } from "../src/state/reducers.js";
import { createStore } from "../src/state/store.js";
import { defaultData } from "../src/domain/migrate.js";
import { todosForDate, activeHabits, habitsForDate, endedHabits, todoMoveBounds, pausedHabits } from "../src/state/selectors.js";
import { globalStreak } from "../src/domain/metrics.js";
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

  test("date를 주면 그날 화면 목록 기준으로 이웃을 찾는다(예정 아닌 습관은 건너뜀)", () => {
    let state = rootReducer(freshState(), newHabit({ id: "r2", name: "s", emoji: "🤸", startDate: "2000-01-01", repeatDays: [1, 3, 5] }));
    // 목요일 9/10: r2 미예정. r3 위로 이동하면 r1과 바뀌어야 한다.
    state = rootReducer(state, { type: A.HABIT_MOVE, id: "r3", dir: -1, date: "2026-09-10" });
    assertDeepEqual(habitsForDate(state.data, "2026-09-10").slice(0, 2).map((h) => h.id), ["r3", "r1"]);
  });

  test("시작일을 앞당기면 그 구간도 예정된다", () => {
    let state = rootReducer(freshState(), newHabit({ name: "늦게 만든" }));
    const id = Object.values(state.data.habits).find((h) => h.name === "늦게 만든").id;
    state = rootReducer(state, newHabit({ id, name: "늦게 만든", startDate: "2026-09-01" }));
    const habit = state.data.habits[id];
    assertEqual(habit.policies[0].effectiveFrom, "2026-09-01");
    assertTrue(policyAt(habit, "2026-09-03") !== null);
  });

  test("끝내기 / 다시 시작", () => {
    let state = rootReducer(freshState(), { type: A.HABIT_END, id: "r1", date: "2026-09-08" });
    assertEqual(habitsForDate(state.data, TODAY).some((h) => h.id === "r1"), false);
    assertTrue(endedHabits(state.data, TODAY).some((h) => h.id === "r1"));
    state = rootReducer(state, { type: A.HABIT_RESUME, id: "r1" });
    assertTrue(habitsForDate(state.data, TODAY).some((h) => h.id === "r1"));
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

  test("투두 이동은 시간 없는 항목끼리만, 시간 있는 항목은 이동 불가", () => {
    let state = freshState();
    state = rootReducer(state, { type: A.TODO_UPSERT, id: null, title: "A", date: TODAY, time: "09:00" });
    state = rootReducer(state, { type: A.TODO_UPSERT, id: null, title: "B", date: TODAY, time: null });
    state = rootReducer(state, { type: A.TODO_UPSERT, id: null, title: "C", date: TODAY, time: null });
    const [a, b, c] = todosForDate(state.data, TODAY);
    assertEqual(rootReducer(state, { type: A.TODO_MOVE, id: b.id, dir: -1 }), state, "B는 무시간 첫 항목이라 위로 불가");
    assertEqual(rootReducer(state, { type: A.TODO_MOVE, id: a.id, dir: 1 }), state, "시간 있는 A는 이동 불가");
    state = rootReducer(state, { type: A.TODO_MOVE, id: c.id, dir: -1 });
    assertDeepEqual(todosForDate(state.data, TODAY).map((t) => t.title), ["A", "C", "B"]);
    assertDeepEqual(todoMoveBounds(state.data, state.data.todos[a.id]), { up: false, down: false });
    assertDeepEqual(todoMoveBounds(state.data, state.data.todos[c.id]), { up: false, down: true });
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

suite("reducers: 쉬어가기 / 복사 / 순서변경", (test) => {
  test("쉬어가기: 기간 동안 예정 아님, 끝나면 자동 재개, 설정 유지", () => {
    let state = rootReducer(freshState(), newHabit({ id: "r2", name: "s", emoji: "🤸", startDate: "2000-01-01", repeatDays: [1, 3, 5], trigger: { type: "time", value: "07:00" } }));
    state = rootReducer(state, { type: A.HABIT_PAUSE, id: "r2", from: TODAY, until: "2026-09-11" });
    const h = state.data.habits.r2;
    assertEqual(habitsForDate(state.data, "2026-09-09").some((x) => x.id === "r2"), false); // 수
    assertEqual(habitsForDate(state.data, "2026-09-11").some((x) => x.id === "r2"), false); // 금
    assertTrue(habitsForDate(state.data, "2026-09-14").some((x) => x.id === "r2"));          // 다음 월
    assertDeepEqual(policyAt(h, "2026-09-14").repeat.days, [1, 3, 5]);
    assertDeepEqual(policyAt(h, "2026-09-14").trigger, { type: "time", value: "07:00" });
  });
  test("기한 없는 쉬어가기는 다시 시작으로 복귀", () => {
    let state = rootReducer(freshState(), { type: A.HABIT_PAUSE, id: "r1", from: TODAY, until: null });
    assertEqual(habitsForDate(state.data, "2026-09-30").some((x) => x.id === "r1"), false);
    assertTrue(pausedHabits(state.data, TODAY).some((x) => x.id === "r1"));
    state = rootReducer(state, { type: A.HABIT_RESUME, id: "r1", today: "2026-09-12" });
    assertEqual(habitsForDate(state.data, "2026-09-11").some((x) => x.id === "r1"), false);
    assertTrue(habitsForDate(state.data, "2026-09-12").some((x) => x.id === "r1"));
  });
  test("쉬는 날은 전체 스트릭을 끊지 않는다", () => {
    const only = { data: { ...freshState().data, habits: { r1: freshState().data.habits.r1 } }, ui: initialUi({ today: TODAY, syncCode: "", firebaseReady: false }) };
    let state = rootReducer(only, { type: A.CHECK_TOGGLE, date: "2026-09-07", habitId: "r1" });
    state = rootReducer(state, { type: A.CHECK_TOGGLE, date: "2026-09-08", habitId: "r1" });
    state = rootReducer(state, { type: A.HABIT_PAUSE, id: "r1", from: TODAY, until: TODAY });
    assertEqual(globalStreak(state.data.habits, state.data.checks, TODAY), 2);
  });
  test("복사: 설정 같고 오늘부터, 기록은 없음", () => {
    let state = rootReducer(freshState(), newHabit({ id: "r2", name: "s", emoji: "🤸", startDate: "2000-01-01", repeatDays: [6, 7] }));
    state = rootReducer(state, { type: A.HABIT_COPY, id: "r2", today: TODAY });
    const copy = Object.values(state.data.habits).find((x) => x.name === "s (복사)");
    assertEqual(copy.startDate, TODAY);
    assertDeepEqual(copy.policies.map((p) => p.effectiveFrom), [TODAY]);
    assertDeepEqual(copy.policies[0].repeat.days, [6, 7]);
    assertEqual(copy.order, 6);
  });
  test("순서변경: 주어진 순서대로 order 재부여", () => {
    const state = rootReducer(freshState(), { type: A.HABIT_REORDER, orderedIds: ["r6", "r5", "r4", "r3", "r2", "r1"] });
    assertDeepEqual(activeHabits(state.data).map((h) => h.id), ["r6", "r5", "r4", "r3", "r2", "r1"]);
  });
});

suite("reducers: 리뷰 반영(휴식 유지, 예약 정책 보존, 동률 order)", (test) => {
  test("쉬는 중에 이름을 바꿔도 휴식과 자동 재개가 유지된다", () => {
    let state = rootReducer(freshState(), { type: A.HABIT_PAUSE, id: "r1", from: TODAY, until: "2026-09-15" });
    state = rootReducer(state, newHabit({ id: "r1", name: "물 바꿈", emoji: "💧", startDate: "2000-01-01", repeatDays: [1, 2, 3, 4, 5, 6, 7], trigger: null }));
    const h = state.data.habits.r1;
    assertEqual(h.name, "물 바꿈");
    assertEqual(policyAt(h, "2026-09-12").status, "paused");
    assertEqual(policyAt(h, "2026-09-16").status, "active");
    assertEqual(habitsForDate(state.data, "2026-09-16").some((x) => x.id === "r1"), true);
  });
  test("예약된 미래 정책은 쉬어가기 뒤에도 설정이 남고, 수정하면 새 설정이 덮인다", () => {
    let state = rootReducer(freshState(), newHabit({ id: "r1", name: "물", emoji: "💧", startDate: "2000-01-01", repeatDays: [1, 2, 3] }));
    // 9/20부터 [1,2,3]로 예약된 상태를 흉내: 미래 시작일로 수정
    state = { ...state, data: { ...state.data, habits: { ...state.data.habits, r1: { ...state.data.habits.r1, policies: [state.data.habits.r1.policies[0], { ...state.data.habits.r1.policies.at(-1), effectiveFrom: "2026-09-20" }] } } } };
    state = rootReducer(state, { type: A.HABIT_PAUSE, id: "r1", from: TODAY, until: "2026-09-12" });
    let h = state.data.habits.r1;
    assertDeepEqual(policyAt(h, "2026-09-21").repeat.days, [1, 2, 3], "예약 정책 보존");
    assertEqual(policyAt(h, "2026-09-13").status, "active", "재개");
    state = rootReducer(state, newHabit({ id: "r1", name: "물", emoji: "💧", startDate: "2000-01-01", repeatDays: [6, 7] }));
    h = state.data.habits.r1;
    assertDeepEqual(policyAt(h, "2026-09-21").repeat.days, [6, 7], "수정한 설정이 미래 정책에도 적용");
    assertEqual(policyAt(h, "2026-09-10").status, "paused", "휴식 유지");
  });
  test("기한 없는 휴식 후 수정해도 휴식 유지, 다시 시작하면 활성", () => {
    let state = rootReducer(freshState(), { type: A.HABIT_PAUSE, id: "r1", from: TODAY, until: null });
    state = rootReducer(state, newHabit({ id: "r1", name: "물2", emoji: "💧", startDate: "2000-01-01", repeatDays: [1] }));
    assertEqual(policyAt(state.data.habits.r1, "2026-10-01").status, "paused");
    state = rootReducer(state, { type: A.HABIT_RESUME, id: "r1", today: "2026-09-20" });
    assertEqual(policyAt(state.data.habits.r1, "2026-10-05").status, "active");
    assertDeepEqual(policyAt(state.data.habits.r1, "2026-10-05").repeat.days, [1]);
  });
  test("order가 겹친 투두도 이동이 된다", () => {
    let state = freshState();
    for (const title of ["a", "b", "c"]) state = rootReducer(state, { type: A.TODO_UPSERT, id: null, title, date: TODAY, time: null });
    const [a, b, c] = todosForDate(state.data, TODAY);
    state = { ...state, data: { ...state.data, todos: { ...state.data.todos, [b.id]: { ...b, order: a.order } } } }; // 동기화 병합으로 겹친 상황
    state = rootReducer(state, { type: A.TODO_MOVE, id: c.id, dir: -1 });
    assertDeepEqual(todosForDate(state.data, TODAY).map((t) => t.title), ["a", "c", "b"]);
    const orders = todosForDate(state.data, TODAY).map((t) => t.order);
    assertEqual(new Set(orders).size, 3);
  });
  test("순서변경이 변화 없으면 같은 참조, 이월은 모든 과거 미완료", () => {
    const state = freshState();
    assertEqual(rootReducer(state, { type: A.HABIT_REORDER, orderedIds: ["r1", "r2", "r3", "r4", "r5", "r6"] }), state);
    let s2 = rootReducer(state, { type: A.TODO_UPSERT, id: null, title: "그제", date: "2026-09-07", time: null });
    s2 = rootReducer(s2, { type: A.TODO_UPSERT, id: null, title: "어제", date: "2026-09-08", time: null });
    s2 = rootReducer(s2, { type: A.TODO_CARRY, to: TODAY });
    assertDeepEqual(todosForDate(s2.data, TODAY).map((t) => t.title), ["그제", "어제"]);
  });
});

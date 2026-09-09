import { suite, assertEqual, assertDeepEqual } from "./harness.js";
import { quadrantOf, compareTodos, parseTodoInput, priorityBadges } from "../src/domain/todo.js";
import { rootReducer, A, initialUi } from "../src/state/reducers.js";
import { defaultData } from "../src/domain/migrate.js";
import { todosForDate, quadrantGroups, todoMoveBounds } from "../src/state/selectors.js";

const TODAY = "2026-09-09";
const t = (over) => ({ id: "x", title: "x", date: TODAY, time: null, order: 0, done: false, urgent: false, important: false, classified: false, ...over });

suite("todo: 사분면", (test) => {
  test("레거시(false/false, 미분류)는 Q4가 아니라 미분류", () => {
    assertEqual(quadrantOf(t({})), null);
    assertEqual(quadrantOf(t({ classified: true })).id, "q4");
    assertEqual(quadrantOf(t({ classified: true, urgent: true, important: true })).id, "q1");
    assertEqual(quadrantOf(t({ classified: true, important: true })).id, "q2");
    assertEqual(quadrantOf(t({ classified: true, urgent: true })).id, "q3");
  });
  test("정렬: 시간순 → 사분면순 → 수동 순서", () => {
    const list = [
      t({ id: "a", order: 0 }),                                   // 미분류
      t({ id: "b", order: 1, classified: true, urgent: true, important: true }), // q1
      t({ id: "c", time: "10:00", order: 5 }),
      t({ id: "d", order: 2, classified: true, important: true }), // q2
      t({ id: "e", time: "08:00", order: 9 }),
    ];
    assertDeepEqual([...list].sort(compareTodos).map((x) => x.id), ["e", "c", "b", "d", "a"]);
  });
  test("배지", () => {
    assertEqual(priorityBadges(t({})), "");
    assertEqual(priorityBadges(t({ classified: true, urgent: true, important: true })), "🔥⭐");
  });
});

suite("todo: 빠른 입력 파싱", (test) => {
  test("HH:MM", () => assertDeepEqual(parseTodoInput("14:00 병원 전화"), { title: "병원 전화", time: "14:00" }));
  test("오후 2시", () => assertDeepEqual(parseTodoInput("오후 2시 병원"), { title: "병원", time: "14:00" }));
  test("오전 9시 30분", () => assertDeepEqual(parseTodoInput("오전 9시 30분 회의"), { title: "회의", time: "09:30" }));
  test("2pm / 9:15am", () => {
    assertDeepEqual(parseTodoInput("2pm 택배"), { title: "택배", time: "14:00" });
    assertDeepEqual(parseTodoInput("9:15am 운동"), { title: "운동", time: "09:15" });
  });
  test("14시 반", () => assertDeepEqual(parseTodoInput("14시 반 커피"), { title: "커피", time: "14:30" }));
  test("시간 없음 / 잘못된 시간은 그대로", () => {
    assertDeepEqual(parseTodoInput("그냥 할 일"), { title: "그냥 할 일", time: null });
    assertDeepEqual(parseTodoInput("25:00 이상한"), { title: "25:00 이상한", time: null });
  });
});

suite("todo: 우선순위 리듀서와 셀렉터", (test) => {
  const fresh = () => ({ data: defaultData(TODAY), ui: initialUi({ today: TODAY, syncCode: "", firebaseReady: false }) });
  test("TODO_PRIORITY로 분류하고 해제한다", () => {
    let state = rootReducer(fresh(), { type: A.TODO_UPSERT, id: null, title: "a", date: TODAY, time: null });
    const id = todosForDate(state.data, TODAY)[0].id;
    state = rootReducer(state, { type: A.TODO_PRIORITY, id, priority: { urgent: true, important: false } });
    assertEqual(quadrantOf(state.data.todos[id]).id, "q3");
    state = rootReducer(state, { type: A.TODO_PRIORITY, id, priority: null });
    assertEqual(quadrantOf(state.data.todos[id]), null);
  });
  test("upsert에 priority를 주면 분류되고, 안 주면 기존 값 유지", () => {
    let state = rootReducer(fresh(), { type: A.TODO_UPSERT, id: null, title: "a", date: TODAY, time: null, priority: { urgent: true, important: true } });
    const id = todosForDate(state.data, TODAY)[0].id;
    assertEqual(quadrantOf(state.data.todos[id]).id, "q1");
    state = rootReducer(state, { type: A.TODO_UPSERT, id, title: "a2", date: TODAY, time: "09:00" });
    assertEqual(quadrantOf(state.data.todos[id]).id, "q1");
  });
  test("quadrantGroups와 이동 범위는 같은 사분면 안에서만", () => {
    let state = fresh();
    for (const [title, p] of [["a", null], ["b", { urgent: true, important: true }], ["c", { urgent: true, important: true }]]) {
      state = rootReducer(state, { type: A.TODO_UPSERT, id: null, title, date: TODAY, time: null, priority: p });
    }
    const groups = quadrantGroups(state.data, TODAY);
    assertDeepEqual(groups.q1.map((x) => x.title), ["b", "c"]);
    assertDeepEqual(groups.none.map((x) => x.title), ["a"]);
    const c = groups.q1[1];
    assertDeepEqual(todoMoveBounds(state.data, c), { up: true, down: false });
    state = rootReducer(state, { type: A.TODO_MOVE, id: c.id, dir: -1 });
    assertDeepEqual(quadrantGroups(state.data, TODAY).q1.map((x) => x.title), ["c", "b"]);
    assertDeepEqual(todosForDate(state.data, TODAY).map((x) => x.title), ["c", "b", "a"]);
  });
});

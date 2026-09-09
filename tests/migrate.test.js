import { suite, assertEqual, assertDeepEqual, assertTrue } from "./harness.js";
import { migrateLegacy, migrateAny, defaultData, isV3Envelope } from "../src/domain/migrate.js";
import { SCHEMA_VERSION } from "../src/config.js";

const TODAY = "2026-09-09";

const legacy = () => ({
  routines: [
    { id: "r1", text: "물 한 잔", category: "morning", emoji: "💧" },
    { id: "r2", text: "운동", category: "health", emoji: "🏃" },
  ],
  checks: {
    "2026-09-01": { r1: true, r2: false },
    "2026-09-03": { r1: true, r2: true },
  },
  todos: {
    "2026-09-03": [{ id: "t1", text: "택배", done: false }, { id: "t2", text: "전화", done: true }],
  },
});

suite("migrate: v2 → v3", (test) => {
  test("습관은 맵으로, 순서와 카테고리를 보존한다", () => {
    const { data } = migrateLegacy(legacy(), TODAY);
    assertDeepEqual(Object.keys(data.habits), ["r1", "r2"]);
    assertEqual(data.habits.r1.order, 0);
    assertEqual(data.habits.r2.order, 1);
    assertEqual(data.habits.r2.legacyCategory, "health");
    assertEqual(data.habits.r1.name, "물 한 잔");
  });

  test("정책은 매일 반복, 시작일은 가장 이른 기록일", () => {
    const { data } = migrateLegacy(legacy(), TODAY);
    const habit = data.habits.r1;
    assertEqual(habit.startDate, "2026-09-01");
    assertEqual(habit.policies.length, 1);
    assertDeepEqual(habit.policies[0].repeat.days, [1, 2, 3, 4, 5, 6, 7]);
    assertDeepEqual(habit.policies[0].goalTagIds, ["morning"]);
    assertEqual(habit.policies[0].status, "active");
  });

  test("기록이 없으면 시작일은 오늘", () => {
    const { data } = migrateLegacy({ routines: legacy().routines, checks: {}, todos: {} }, TODAY);
    assertEqual(data.habits.r1.startDate, TODAY);
  });

  test("체크는 true→1, false는 버린다", () => {
    const { data } = migrateLegacy(legacy(), TODAY);
    assertDeepEqual(data.checks["2026-09-01"], { r1: 1 });
    assertDeepEqual(data.checks["2026-09-03"], { r1: 1, r2: 1 });
  });

  test("투두는 id 맵 + date 필드, 순서 보존, 새 필드 기본값", () => {
    const { data } = migrateLegacy(legacy(), TODAY);
    assertEqual(data.todos.t1.date, "2026-09-03");
    assertEqual(data.todos.t1.order, 0);
    assertEqual(data.todos.t2.order, 1);
    assertEqual(data.todos.t2.done, true);
    assertEqual(data.todos.t1.time, null);
    assertEqual(data.todos.t1.urgent, false);
  });

  test("카테고리 6개가 목표 태그로 만들어진다", () => {
    const { data } = migrateLegacy(legacy(), TODAY);
    assertEqual(Object.keys(data.goalTags).length, 6);
    assertEqual(data.goalTags.health.emoji, "💪");
  });

  test("입력을 변경하지 않는다", () => {
    const source = legacy();
    const snapshot = JSON.stringify(source);
    migrateLegacy(source, TODAY);
    assertEqual(JSON.stringify(source), snapshot);
  });

  test("잘못된 항목은 경고로 남기고 계속 진행한다", () => {
    const source = legacy();
    source.checks["not-a-date"] = { r1: true };
    source.routines.push({ text: "id 없음" });
    const { data, warnings } = migrateLegacy(source, TODAY);
    assertEqual(Object.keys(data.habits).length, 2);
    assertTrue(warnings.length >= 2, "경고 2개 이상");
  });

  test("같은 todo id가 다른 날짜에 있으면 충돌하지 않는다", () => {
    const source = legacy();
    source.todos["2026-09-04"] = [{ id: "t1", text: "중복", done: false }];
    const { data } = migrateLegacy(source, TODAY);
    assertEqual(Object.keys(data.todos).length, 3);
  });
});

suite("migrate: migrateAny", (test) => {
  test("v3 envelope는 그대로 통과한다(멱등)", () => {
    const { data } = migrateLegacy(legacy(), TODAY);
    const envelope = { schemaVersion: SCHEMA_VERSION, data };
    const result = migrateAny(envelope, TODAY);
    assertEqual(result.source, "v3");
    assertDeepEqual(result.data, data);
  });

  test("version:2 백업 파일도 변환한다", () => {
    const backup = { ...legacy(), version: 2, exportedAt: "x" };
    const result = migrateAny(backup, TODAY);
    assertEqual(result.source, "legacy");
    assertEqual(Object.keys(result.data.habits).length, 2);
  });

  test("미래 버전은 거부한다", () => {
    const result = migrateAny({ schemaVersion: SCHEMA_VERSION + 1, data: {} }, TODAY);
    assertEqual(result.source, "future");
    assertEqual(result.data, null);
  });

  test("알 수 없는 형식은 null", () => {
    assertEqual(migrateAny({ foo: 1 }, TODAY).data, null);
    assertEqual(migrateAny(null, TODAY).data, null);
  });

  test("기본 데이터는 샘플 습관 6개", () => {
    const data = defaultData(TODAY);
    assertEqual(Object.keys(data.habits).length, 6);
    assertTrue(isV3Envelope({ schemaVersion: SCHEMA_VERSION, data }));
  });
});

import { SCHEMA_VERSION, SYNC_DEBOUNCE_MS } from "../config.js";
import { migrateLegacy, normalizeV3 } from "../domain/migrate.js";
import { monthKey } from "../utils/date.js";

const HABITS_DOC = "habits";
const ENTITY_SLICES = ["habits", "goalTags", "routines"];

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// ── 데이터 ↔ 문서 변환 ──

function monthsOf(data) {
  const months = new Set();
  Object.values(data.todos).forEach((t) => months.add(monthKey(t.date)));
  Object.keys(data.checks).forEach((date) => months.add(monthKey(date)));
  return months;
}

function todosOfMonth(data, month) {
  return Object.fromEntries(Object.entries(data.todos).filter(([, t]) => monthKey(t.date) === month));
}

function checksOfMonth(data, month) {
  return Object.fromEntries(Object.entries(data.checks).filter(([date]) => monthKey(date) === month));
}

function habitsDocOf(data) {
  return { habits: data.habits, goalTags: data.goalTags, routines: data.routines, settings: data.settings };
}

/** 두 맵을 비교해 merge 페이로드를 만든다. 사라진 키는 FieldValue.delete(). */
function diffMap(prev = {}, next = {}, deleteValue, depth = 1) {
  const out = {};
  for (const [key, value] of Object.entries(next)) {
    if (depth > 1 && typeof value === "object" && value !== null) {
      const nested = diffMap(prev[key] || {}, value, deleteValue, depth - 1);
      if (Object.keys(nested).length) out[key] = nested;
    } else if (!same(prev[key], value)) {
      out[key] = value;
    }
  }
  for (const key of Object.keys(prev)) {
    if (!(key in next)) out[key] = deleteValue;
  }
  return out;
}

// ── 동기화 엔진 ──

export function createSync({ firebase, config, getData, applyRemote, onStatus }) {
  let db = null;
  let ready = false;
  try {
    firebase.initializeApp(config);
    db = firebase.firestore();
    ready = true;
  } catch (error) {
    console.error("Firebase 초기화 실패:", error);
  }

  let code = "";
  let unsubscribe = null;
  let timer = null;
  let synced = null; // 마지막으로 원격과 일치했다고 아는 문서별 내용

  const deleteValue = () => firebase.firestore.FieldValue.delete();
  const stamp = () => firebase.firestore.FieldValue.serverTimestamp();
  const dataCol = (ws) => db.collection("workspaces").doc(ws).collection("data");

  function snapshotOf(data) {
    const docs = { [HABITS_DOC]: habitsDocOf(data) };
    for (const month of monthsOf(data)) {
      docs[`todos-${month}`] = { todos: todosOfMonth(data, month) };
      docs[`checks-${month}`] = { checks: checksOfMonth(data, month) };
    }
    return docs;
  }

  async function writeAll(ws, data) {
    const batch = db.batch();
    batch.set(db.collection("workspaces").doc(ws), { schemaVersion: SCHEMA_VERSION, updatedAt: stamp() }, { merge: true });
    const docs = snapshotOf(data);
    for (const [id, body] of Object.entries(docs)) {
      batch.set(dataCol(ws).doc(id), { ...body, updatedAt: stamp() });
    }
    await batch.commit();
    synced = docs;
  }

  /** 원격 문서 하나를 로컬 data에 반영한 patch를 만든다. */
  function patchFromDoc(id, body, data) {
    if (id === HABITS_DOC) {
      const patch = {};
      for (const slice of [...ENTITY_SLICES, "settings"]) {
        if (body[slice] && !same(body[slice], data[slice])) patch[slice] = body[slice];
      }
      return patch;
    }
    if (id.startsWith("todos-")) {
      const month = id.slice(6);
      const remote = body.todos || {};
      if (same(remote, todosOfMonth(data, month))) return {};
      const kept = Object.fromEntries(Object.entries(data.todos).filter(([, t]) => monthKey(t.date) !== month));
      return { todos: { ...kept, ...remote } };
    }
    if (id.startsWith("checks-")) {
      const month = id.slice(7);
      const remote = body.checks || {};
      if (same(remote, checksOfMonth(data, month))) return {};
      const kept = Object.fromEntries(Object.entries(data.checks).filter(([date]) => monthKey(date) !== month));
      return { checks: { ...kept, ...remote } };
    }
    return {};
  }

  function handleSnapshot(snapshot) {
    let data = getData();
    let merged = {};
    for (const change of snapshot.docChanges()) {
      if (change.doc.metadata.hasPendingWrites) continue;
      const { updatedAt: _ts, ...body } = change.doc.data();
      const id = change.doc.id;
      synced = { ...(synced || {}), [id]: body };
      if (change.type === "removed") continue;
      const patch = patchFromDoc(id, body, { ...data, ...merged });
      merged = { ...merged, ...patch };
    }
    if (Object.keys(merged).length) applyRemote(merged);
  }

  function listen(ws) {
    if (unsubscribe) unsubscribe();
    unsubscribe = dataCol(ws).onSnapshot(
      (snapshot) => { onStatus(true); handleSnapshot(snapshot); },
      (error) => { console.error("동기화 수신 오류:", error); onStatus(false); },
    );
  }

  /** 레거시 sync/{code} 문서가 있으면 v3로 변환해 돌려준다. */
  async function readLegacy(ws, todayKey) {
    const snap = await db.collection("sync").doc(ws).get();
    if (!snap.exists) return null;
    const legacy = snap.data();
    if (!Array.isArray(legacy.routines)) return null;
    return migrateLegacy({ routines: legacy.routines, checks: legacy.checks || {}, todos: legacy.todos || {} }, todayKey).data;
  }

  /** 워크스페이스 전체를 읽어 v3 데이터로 조립한다. 없으면 null. */
  async function readWorkspace(ws) {
    const col = await dataCol(ws).get();
    if (col.empty) return null;
    const data = normalizeV3({});
    col.forEach((doc) => {
      const { updatedAt: _ts, ...body } = doc.data();
      if (doc.id === HABITS_DOC) Object.assign(data, body);
      else if (body.todos) Object.assign(data.todos, body.todos);
      else if (body.checks) Object.assign(data.checks, body.checks);
    });
    return normalizeV3(data);
  }

  function schedulePush() {
    clearTimeout(timer);
    timer = setTimeout(() => push().catch((e) => console.error("동기화 전송 실패:", e)), SYNC_DEBOUNCE_MS);
  }

  async function push() {
    if (!code || !synced) return;
    const ws = code;
    const docs = snapshotOf(getData());
    const batch = db.batch();
    let writes = 0;
    const ids = new Set([...Object.keys(docs), ...Object.keys(synced)]);
    for (const id of ids) {
      const next = docs[id];
      const prev = synced[id];
      if (!next) continue; // 월 문서가 통째로 비면 그대로 둔다(빈 맵으로 덮어쓰지 않음)
      const payload = payloadFor(id, prev, next);
      if (!payload) continue;
      batch.set(dataCol(ws).doc(id), { ...payload, updatedAt: stamp() }, { merge: true });
      writes++;
    }
    if (!writes) return;
    await batch.commit();
    if (code === ws) synced = { ...synced, ...docs };
  }

  function payloadFor(id, prev, next) {
    if (!prev) return next;
    if (same(prev, next)) return null;
    if (id === HABITS_DOC) {
      const payload = {};
      for (const slice of ENTITY_SLICES) {
        const diff = diffMap(prev[slice], next[slice], deleteValue());
        if (Object.keys(diff).length) payload[slice] = diff;
      }
      if (!same(prev.settings, next.settings)) payload.settings = next.settings;
      return Object.keys(payload).length ? payload : null;
    }
    if (id.startsWith("todos-")) return { todos: diffMap(prev.todos, next.todos, deleteValue()) };
    if (id.startsWith("checks-")) return { checks: diffMap(prev.checks, next.checks, deleteValue(), 2) };
    return null;
  }

  return {
    ready,
    get code() { return code; },

    /** 로컬 데이터로 새 워크스페이스를 만들고 연결한다. */
    async create(ws, data) {
      await writeAll(ws, data);
      code = ws;
      listen(ws);
    },

    /** 기존 코드에 연결한다. 원격 데이터(v3 또는 레거시 변환)를 돌려준다. 없으면 null. */
    async join(ws, todayKey) {
      let data = await readWorkspace(ws);
      if (!data) {
        data = await readLegacy(ws, todayKey);
        if (!data) return null;
        await writeAll(ws, data);
      }
      code = ws;
      listen(ws);
      return data;
    },

    /** 앱 시작 시 저장된 코드로 재연결. 원격에 아직 v3가 없으면 로컬 데이터로 만든다. */
    async resume(ws, localData, todayKey) {
      const remote = await readWorkspace(ws);
      if (!remote) {
        const legacy = await readLegacy(ws, todayKey);
        await writeAll(ws, legacy || localData);
        code = ws;
        listen(ws);
        return legacy;
      }
      synced = snapshotOf(remote);
      code = ws;
      listen(ws);
      return remote;
    },

    disconnect() {
      if (unsubscribe) unsubscribe();
      unsubscribe = null;
      clearTimeout(timer);
      code = "";
      synced = null;
      onStatus(false);
    },

    notifyChange() {
      if (code) schedulePush();
    },
  };
}

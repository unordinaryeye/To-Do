import { SCHEMA_VERSION, SYNC_DEBOUNCE_MS } from "../config.js";
import { migrateLegacy, normalizeV3 } from "../domain/migrate.js";
import { snapshotOf, emptyDocFor, payloadFor, patchFromDoc, assembleData } from "./docs.js";

export class SyncError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const SERVER = { source: "server" };

/**
 * 동기화 엔진. 구독(onSnapshot)은 오프라인에서도 먼저 걸고, 서버 확인이 필요한 일(워크스페이스 생성,
 * 레거시 이관, 코드 존재 확인)만 source:"server" 읽기로 한다. 캐시 미스를 "원격 없음"으로 오해하지 않는다.
 */
export function createSync({ firebase, config, getData, applyRemote, onStatus, todayKey }) {
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
  let synced = null;      // 문서 id → 마지막으로 원격과 일치한 내용. null이면 아직 원격 상태를 모름
  let bootstrapping = false;

  const deleteValue = () => firebase.firestore.FieldValue.delete();
  const stamp = () => firebase.firestore.FieldValue.serverTimestamp();
  const wsDoc = (ws) => db.collection("workspaces").doc(ws);
  const dataCol = (ws) => wsDoc(ws).collection("data");
  const bodyOf = (doc) => { const { updatedAt: _ts, ...body } = doc.data(); return body; };

  // ── 서버 읽기 ──

  async function assertSchema(ws) {
    const meta = await wsDoc(ws).get(SERVER);
    const version = meta.exists ? meta.data().schemaVersion : null;
    if (version && version > SCHEMA_VERSION) {
      throw new SyncError("schema-too-new", "다른 기기의 앱이 더 새 버전이에요. 앱을 업데이트해 주세요");
    }
  }

  /** 서버에서 워크스페이스 전체를 읽는다. 없으면 null, 오프라인이면 throw. */
  async function readWorkspace(ws) {
    await assertSchema(ws);
    const col = await dataCol(ws).get(SERVER);
    if (col.empty) return null;
    const docs = [];
    col.forEach((doc) => docs.push({ id: doc.id, body: bodyOf(doc) }));
    return normalizeV3(assembleData(docs, normalizeV3({})));
  }

  /** 레거시 sync/{code} 문서를 서버에서 읽어 v3로 변환. 없으면 null. */
  async function readLegacy(ws) {
    const snap = await db.collection("sync").doc(ws).get(SERVER);
    if (!snap.exists || !Array.isArray(snap.data().routines)) return null;
    const legacy = snap.data();
    return migrateLegacy({ routines: legacy.routines, checks: legacy.checks || {}, todos: legacy.todos || {} }, todayKey()).data;
  }

  async function writeAll(ws, data) {
    const batch = db.batch();
    batch.set(wsDoc(ws), { schemaVersion: SCHEMA_VERSION, updatedAt: stamp() }, { merge: true });
    const docs = snapshotOf(data);
    for (const [id, body] of Object.entries(docs)) batch.set(dataCol(ws).doc(id), { ...body, updatedAt: stamp() });
    await batch.commit();
    synced = docs;
  }

  // ── 수신 ──

  /** 서버가 "문서 없음"을 확인해 줬을 때만 워크스페이스를 만든다(레거시 이관 또는 로컬 업로드). */
  async function bootstrap(ws) {
    if (bootstrapping || synced) return;
    bootstrapping = true;
    try {
      const legacy = await readLegacy(ws);
      await writeAll(ws, legacy || getData());
      if (legacy) applyRemote(legacy);
    } catch (error) {
      console.error("워크스페이스 생성 실패:", error);
    } finally {
      bootstrapping = false;
    }
  }

  function handleSnapshot(ws, snapshot) {
    if (snapshot.empty && !snapshot.metadata.fromCache && !synced) { bootstrap(ws); return; }
    const data = getData();
    let merged = {};
    for (const change of snapshot.docChanges()) {
      if (change.doc.metadata.hasPendingWrites) continue;
      const body = bodyOf(change.doc);
      synced = { ...(synced || {}), [change.doc.id]: body };
      if (change.type === "removed") continue;
      merged = { ...merged, ...patchFromDoc(change.doc.id, body, { ...data, ...merged }) };
    }
    if (Object.keys(merged).length) applyRemote(merged);
  }

  function listen(ws) {
    if (unsubscribe) unsubscribe();
    code = ws;
    unsubscribe = dataCol(ws).onSnapshot(
      { includeMetadataChanges: false },
      (snapshot) => { onStatus(!snapshot.metadata.fromCache); handleSnapshot(ws, snapshot); },
      (error) => { console.error("동기화 수신 오류:", error); onStatus(false); },
    );
  }

  // ── 송신 ──

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
    for (const id of new Set([...Object.keys(docs), ...Object.keys(synced)])) {
      const next = docs[id] || emptyDocFor(id);
      if (!next) continue;
      const payload = payloadFor(id, synced[id], next, deleteValue());
      if (!payload) continue;
      batch.set(dataCol(ws).doc(id), { ...payload, updatedAt: stamp() }, { merge: true });
      writes++;
    }
    if (!writes) return;
    await batch.commit();
    if (code === ws) synced = { ...synced, ...docs };
  }

  return {
    ready,
    get code() { return code; },

    /** 로컬 데이터로 새 워크스페이스를 만들고 연결한다. 온라인이어야 한다. */
    async create(ws, data) {
      await writeAll(ws, data);
      listen(ws);
    },

    /** 기존 코드에 연결. 원격 데이터(v3 또는 레거시 변환)를 돌려주고, 코드가 없으면 null. 오프라인이면 throw. */
    async join(ws) {
      let data = await readWorkspace(ws);
      if (!data) {
        data = await readLegacy(ws);
        if (!data) return null;
        await writeAll(ws, data);
      } else {
        synced = snapshotOf(data);
      }
      listen(ws);
      return data;
    },

    /** 앱 시작 시 저장된 코드로 재연결. 오프라인이어도 구독을 걸어 두고, 서버 응답이 오면 상태를 맞춘다. */
    resume(ws) {
      listen(ws);
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

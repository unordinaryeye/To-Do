import { STORAGE_KEY, LEGACY_BACKUP_KEY, SYNC_CODE_KEY, LAST_BACKUP_KEY, SCHEMA_VERSION, BACKUP_REMINDER_DAYS } from "../config.js";
import { migrateAny, defaultData } from "../domain/migrate.js";

function safeParse(raw) {
  if (raw == null) return undefined;
  try { return JSON.parse(raw); } catch { return undefined; }
}

function readLegacy() {
  const routines = safeParse(localStorage.getItem("routines"));
  if (!Array.isArray(routines)) return null;
  return {
    routines,
    checks: safeParse(localStorage.getItem("checks")) || {},
    todos: safeParse(localStorage.getItem("todos")) || {},
  };
}

/**
 * 부팅 시 데이터 로드. 우선순위: v3 envelope → 레거시 3키(변환 후 원본 보존) → 기본 샘플.
 * 반환: { data, migrated, warnings }
 */
export function loadData(todayKey) {
  const envelope = safeParse(localStorage.getItem(STORAGE_KEY));
  if (envelope) {
    const result = migrateAny(envelope, todayKey);
    if (result.data) return { data: result.data, migrated: false, warnings: result.warnings };
  }
  const legacy = readLegacy();
  if (legacy) {
    const result = migrateAny(legacy, todayKey);
    if (result.data) {
      try { localStorage.setItem(LEGACY_BACKUP_KEY, JSON.stringify(legacy)); } catch { /* 용량 초과 시 백업 생략 */ }
      saveData(result.data);
      return { data: result.data, migrated: true, warnings: result.warnings };
    }
  }
  const fresh = defaultData(todayKey);
  saveData(fresh);
  return { data: fresh, migrated: false, warnings: [] };
}

export function saveData(data) {
  const envelope = { schemaVersion: SCHEMA_VERSION, savedAt: new Date().toISOString(), data };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    return true;
  } catch (error) {
    console.error("로컬 저장 실패:", error);
    return false;
  }
}

export const getSyncCode = () => localStorage.getItem(SYNC_CODE_KEY) || "";
export const setSyncCode = (code) => (code ? localStorage.setItem(SYNC_CODE_KEY, code) : localStorage.removeItem(SYNC_CODE_KEY));

export const getLastBackup = () => localStorage.getItem(LAST_BACKUP_KEY) || null;
export const setLastBackup = () => localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
export const clearLastBackup = () => localStorage.removeItem(LAST_BACKUP_KEY);

export function needsBackupReminder(data, syncCode) {
  if (syncCode) return false;
  const last = getLastBackup();
  if (!last) return Object.keys(data.checks).length > 3;
  const days = (Date.now() - new Date(last).getTime()) / (1000 * 3600 * 24);
  return days > BACKUP_REMINDER_DAYS;
}

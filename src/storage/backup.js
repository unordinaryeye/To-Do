import { SCHEMA_VERSION } from "../config.js";
import { migrateAny } from "../domain/migrate.js";

export function buildBackup(data) {
  return {
    format: "daily-routine-backup",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function backupFileName(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `루틴백업_${y}${m}${d}.json`;
}

export function downloadBackup(data) {
  const blob = new Blob([JSON.stringify(buildBackup(data), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = backupFileName();
  link.click();
  URL.revokeObjectURL(url);
}

/** 백업 파일 텍스트를 v3 데이터로. 실패 시 Error를 던진다. */
export function parseBackup(text, todayKey) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error("JSON을 읽을 수 없어요"); }
  const result = migrateAny(parsed, todayKey);
  if (!result.data) throw new Error(result.warnings[0] || "알 수 없는 백업 형식이에요");
  return result;
}

export function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(String(e.target.result));
    reader.onerror = () => reject(new Error("파일을 읽을 수 없어요"));
    reader.readAsText(file);
  });
}

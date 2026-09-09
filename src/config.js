// Firebase 웹 설정은 공개용 값이다. 접근 제어는 Firestore Rules가 담당한다.
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAe7avifEe4sKx_JS6oe6CEcX9UCEKTzXQ",
  authDomain: "daily-routine-1fbd8.firebaseapp.com",
  projectId: "daily-routine-1fbd8",
  storageBucket: "daily-routine-1fbd8.firebasestorage.app",
  messagingSenderId: "139544196262",
  appId: "1:139544196262:web:ceb8876580071b6368f067",
};

export const SCHEMA_VERSION = 3;
export const STORAGE_KEY = "dailyRoutine.v3";
export const LEGACY_BACKUP_KEY = "dailyRoutine.v2backup";
export const SYNC_CODE_KEY = "syncCode";
export const LAST_BACKUP_KEY = "lastBackup";
export const SYNC_DEBOUNCE_MS = 500;
export const BACKUP_REMINDER_DAYS = 7;

export const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
/** v2에는 습관 생성일이 없다. 예전 앱처럼 "항상 있었던" 것으로 취급하기 위한 시작일. */
export const LEGACY_START_DATE = "2000-01-01";

/** 현재 UI가 쓰는 카테고리. 마이그레이션 시 같은 id/이모지/색으로 목표 태그가 만들어진다. */
export const CATEGORIES = [
  { id: "morning", label: "🌅 모닝 루틴", emoji: "🌅", name: "모닝 루틴", color: "#F59E0B" },
  { id: "work", label: "💼 업무", emoji: "💼", name: "업무", color: "#3B82F6" },
  { id: "health", label: "💪 건강", emoji: "💪", name: "건강", color: "#10B981" },
  { id: "evening", label: "🌙 이브닝 루틴", emoji: "🌙", name: "이브닝 루틴", color: "#8B5CF6" },
  { id: "selfcare", label: "🧘 셀프케어", emoji: "🧘", name: "셀프케어", color: "#EC4899" },
  { id: "study", label: "📚 학습", emoji: "📚", name: "학습", color: "#F97316" },
];

export const DEFAULT_ROUTINES = [
  { id: "r1", text: "물 한 잔 마시기", category: "morning", emoji: "💧" },
  { id: "r2", text: "10분 스트레칭", category: "morning", emoji: "🤸" },
  { id: "r3", text: "감사 일기 쓰기", category: "morning", emoji: "📝" },
  { id: "r4", text: "30분 운동", category: "health", emoji: "🏃" },
  { id: "r5", text: "독서 30분", category: "evening", emoji: "📖" },
  { id: "r6", text: "내일 할 일 정리", category: "evening", emoji: "📋" },
];

export const EMOJI_OPTIONS = ["✅", "💧", "🤸", "📝", "🏃", "📖", "📋", "🧘", "💪", "🎯", "🧠", "💊", "🥗", "☕", "🛌", "🎵", "🖊️", "💻", "🌿", "🙏"];

export const TODO_COLOR = "#6366F1";
export const COLOR_DONE = "#10B981";
export const COLOR_PARTIAL = "#F59E0B";
export const COLOR_NONE = "#E7E5E4";
export const COLOR_LOW = "#EF4444";

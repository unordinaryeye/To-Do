/* 앱 셸 캐시. 데이터(Firestore)는 건드리지 않는다. 버전을 올리면 옛 캐시를 지운다. */
const VERSION = "r3-1";
const CACHE = `daily-routine-${VERSION}`;
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest",
  "./styles/base.css", "./styles/components.css", "./styles/layout.css",
  "./src/main.js", "./src/config.js",
  "./src/utils/date.js", "./src/utils/dom.js", "./src/utils/id.js",
  "./src/domain/schedule.js", "./src/domain/metrics.js", "./src/domain/migrate.js", "./src/domain/format.js", "./src/domain/todo.js", "./src/domain/mandala.js",
  "./src/state/store.js", "./src/state/reducers.js", "./src/state/selectors.js",
  "./src/storage/local.js", "./src/storage/backup.js",
  "./src/sync/docs.js", "./src/sync/firestore.js",
  "./src/ui/app.js", "./src/ui/actions.js", "./src/ui/router.js", "./src/ui/parts.js", "./src/ui/toast.js",
  "./src/ui/home.js", "./src/ui/todo.js", "./src/ui/week.js", "./src/ui/forms.js", "./src/ui/sheets.js",
  "./src/ui/stats.js", "./src/ui/stats-views.js", "./src/ui/goals.js", "./src/ui/settings.js", "./src/ui/reorder.js", "./src/ui/mandala.js", "./src/ui/reminders.js",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});

/** 같은 출처의 앱 파일만 캐시 우선. 나머지(Firestore, 폰트, CDN)는 네트워크 그대로. */
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((hit) => hit || fetch(event.request).then((res) => {
      if (res.ok) caches.open(CACHE).then((cache) => cache.put(event.request, res.clone()));
      return res;
    })).catch(() => caches.match("./index.html")),
  );
});

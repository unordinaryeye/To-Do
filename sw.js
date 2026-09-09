/*
 * 앱 셸 캐시. 데이터(Firestore)는 건드리지 않는다.
 * - 페이지 이동(index.html): 네트워크 우선, 실패 시 캐시 → 배포 직후 새 셸을 바로 받는다.
 * - 같은 출처의 정적 파일: 캐시로 즉시 응답하고 뒤에서 네트워크로 갱신(stale-while-revalidate)
 *   → sw.js가 안 바뀌어도 다음 실행 때 새 파일이 적용된다. VERSION은 캐시를 통째로 비우고 싶을 때만 올린다.
 */
const VERSION = "r3-2";
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
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put("./index.html", res.clone());
    return res;
  } catch {
    return (await cache.match("./index.html")) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  const refresh = fetch(request).then((res) => {
    if (res.ok) cache.put(request, res.clone());
    return res;
  }).catch(() => null);
  return cached || (await refresh) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return; // Firestore·폰트·CDN은 그대로
  if (request.mode === "navigate") { event.respondWith(networkFirst(request)); return; }
  event.respondWith(staleWhileRevalidate(request));
});

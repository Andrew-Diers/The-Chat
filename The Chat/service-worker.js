const CACHE_NAME = "the-chat-shell-v10";
const APP_SHELL = [
  "/",
  "/theme.css",
  "/compact-layout.css",
  "/chat-box-minimum.css",
  "/auth-feedback.css",
  "/app-feedback.css",
  "/notifications.css",
  "/confirm.css",
  "/admin-controls.css",
  "/chat-schedule.css",
  "/diagnostics.css",
  "/notifications.js",
  "/diagnostics.js",
  "/confirm.js",
  "/spellcheck.js",
  "/admin-controls.js",
  "/chat-schedule.js",
  "/manifest.webmanifest",
  "/icons/chat-now-192.svg",
  "/icons/chat-now-512.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
    .then(cache => cache.addAll(APP_SHELL))
    .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
    .then(keys => Promise.all(
      keys
      .filter(key => key.startsWith("the-chat-shell-") && key !== CACHE_NAME)
      .map(key => caches.delete(key))
    ))
    .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Never cache backend endpoints or dynamic/user-specific responses.
  if (url.pathname.startsWith("/api/") || url.pathname === "/history") return;

  const isAppShellFile = APP_SHELL.includes(url.pathname);
  if (!isAppShellFile) return;

  event.respondWith(
    fetch(request)
    .then(response => {
      if (response.ok && response.type === "basic") {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    })
    .catch(async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === "navigate") {
        return (await caches.match("/")) || Response.error();
      }
      return Response.error();
    })
  );
});

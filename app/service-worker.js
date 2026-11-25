const CACHE = "giltclub-v3";
const APP_SHELL = ["/app/", "/app/index.html"];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("giltclub-") && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

// FCM sends data-only messages. This worker displays the notification so the
// same push is not rendered twice by both FCM and a custom notification handler.
self.addEventListener("push", event => {
  if (!event.data) return;
  event.waitUntil((async () => {
    let payload = {};
    try { payload = event.data.json(); } catch (_) { return; }
    const data = payload.data || payload;
    const title = data.title || "GMTC Community";
    const options = {
      body: data.body || "Ada pengingat sesi GMTC untuk kamu.",
      icon: "/app/image/logo_giltclub.webp",
      badge: "/app/image/logo_giltclub.webp",
      tag: data.scheduleId ? "gmtc-session-" + data.scheduleId : "gmtc-push",
      renotify: false,
      data: { url: data.url || "/app/" }
    };
    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/app/", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(targetUrl);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isAppShell = url.pathname === "/app/" || url.pathname === "/app/index.html";
  if (isAppShell) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request, { cache: "no-store" });
        const cache = await caches.open(CACHE);
        cache.put(request, fresh.clone());
        return fresh;
      } catch (error) {
        return (await caches.match(request)) || Response.error();
      }
    })());
  } else {
    event.respondWith(fetch(request, { cache: "no-store" }));
  }
});

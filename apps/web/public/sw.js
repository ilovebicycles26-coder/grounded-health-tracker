/* global self, caches, fetch, clients, URL, Response */
const CACHE = 'grounded-shell-v1';
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add('./')));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin)
    return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok)
          caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
        return response;
      })
      .catch(
        async () =>
          (await caches.match(event.request)) ||
          (event.request.mode === 'navigate' ? caches.match('./') : Response.error()),
      ),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = String(event.notification.data?.url || './').replace(/^\//, '');
  const target = new URL(path, self.registration.scope).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const existing = windows[0];
      return existing
        ? existing.navigate(target).then(() => existing.focus())
        : clients.openWindow(target);
    }),
  );
});

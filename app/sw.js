// Service worker de Ferekan (version web).
// - Permet l'installation sur l'écran d'accueil (Android / Chrome).
// - Toujours le réseau d'abord : les utilisateurs ont toujours la dernière version.
// - Hors connexion : affiche la dernière page d'accueil enregistrée.
// - Notifications (Web Push) : affiche le message et ouvre le bon écran au toucher.
const CACHE = 'ferekan-shell-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.add(new URL('./', self.registration.scope))).catch(() => undefined));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Seulement les pages de l'app (pas Supabase, pas les images)
  if (req.method !== 'GET' || req.mode !== 'navigate') return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(new URL('./', self.registration.scope), copy)).catch(() => undefined);
        }
        return res;
      })
      .catch(() => caches.match(new URL('./', self.registration.scope)).then((r) => r || Response.error())),
  );
});

// --- Notifications ---------------------------------------------------------
self.addEventListener('push', (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = { body: event.data ? event.data.text() : '' };
  }
  const scope = self.registration.scope;
  event.waitUntil(
    self.registration.showNotification(d.title || 'Ferekan', {
      body: d.body || '',
      icon: scope + 'icons/icon-192.png',
      badge: scope + 'icons/icon-192.png',
      tag: d.tag || undefined,
      renotify: !!d.tag,
      data: { path: typeof d.path === 'string' && d.path.startsWith('/') ? d.path : '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.path) || '/';
  const url = new URL(path.replace(/^\//, ''), self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.registration.scope));
      if (open) {
        // L'app est déjà ouverte : on lui demande d'aller à l'écran, puis on l'affiche
        open.postMessage({ type: 'ferekan-open', path });
        return open.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});

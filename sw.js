// Minimal service worker — caches the app shell so it installs and opens fast.
// Notes themselves are always fetched live from the GitHub API (never cached here).
const CACHE = 'notes-shell-v7';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ---- Web Push ----
self.addEventListener('push', e => {
  let data = { title: 'Notes', body: '' };
  try { data = e.data.json(); } catch { if (e.data) data.body = e.data.text(); }
  e.waitUntil(self.registration.showNotification(data.title || 'Notes', {
    body: data.body || '',
    tag: data.tag,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(cs => {
    for (const c of cs) if ('focus' in c) return c.focus();
    if (clients.openWindow) return clients.openWindow('./');
  }));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Never intercept GitHub API calls — always go to network.
  if (url.hostname === 'api.github.com') return;
  if (url.origin !== location.origin) return;
  // App shell: network-first (so updates show immediately), fall back to cache offline.
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

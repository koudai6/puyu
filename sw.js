/* 字卡 / 聊天站 Service Worker — 支持安装为 App、离线打开、通知 */
const CACHE = 'puyu-v2-fullscreen';
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './favicon-32.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 导航请求：网络优先，失败用缓存（保证更新及时）
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match(req)))
    );
    return;
  }

  // 静态资源：缓存优先
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) { return client.focus().then(() => { if (event.notification.data && event.notification.data.url && 'navigate' in client) return client.navigate(event.notification.data.url); }); }
      }
      if (self.clients.openWindow) return self.clients.openWindow((event.notification.data && event.notification.data.url) || './');
    })
  );
});


// 接收真实 Web Push 服务端发送的推送。仅有此监听器不会自行产生后台字卡；
// 仍需客户端订阅 PushManager，并由服务端向订阅端点发送 push。
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (_) { data = { body: event.data ? event.data.text() : '' }; }
  const title = String(data.title || '知念易杳');
  const options = {
    body: String(data.body || data.text || '有新的字卡消息'),
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: data.tag ? String(data.tag) : 'puyu-push',
    data: { url: data.url || './' },
    renotify: true
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

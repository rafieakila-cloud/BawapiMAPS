const CACHE = 'bacapi-maps-v4';
const ASSETS = ['./','./index.html','./styles.css','./app.js','./places.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
const CDN = ['unpkg.com','tiles.openfreemap.org','basemaps.cartocdn.com','server.arcgisonline.com','upload.wikimedia.org'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).catch(()=>{})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if(e.request.method!=='GET') return;
  const url = new URL(e.request.url);
  const isCdn = CDN.some(h => url.hostname.includes(h));
  if(url.origin === location.origin || isCdn){
    e.respondWith(caches.open(CACHE).then(async cache => {
      const cached = await cache.match(e.request);
      const net = fetch(e.request).then(res => { if(res && (res.ok || res.type==='opaque')) cache.put(e.request, res.clone()).catch(()=>{}); return res; }).catch(()=>cached);
      return cached || net;
    }));
    return;
  }
  e.respondWith(fetch(e.request).catch(()=>caches.match('./index.html')));
});

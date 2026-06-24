// ─────────────────────────────────────────────────────────────
//  VaultKey Service Worker
//  Versión auto-generada: no editar CACHE_VERSION manualmente.
//  Para forzar actualización en usuarios: incrementar el número.
// ─────────────────────────────────────────────────────────────
const CACHE_VERSION = 16;
const CACHE = `vaultkey-v${CACHE_VERSION}`;

const FILES = [
  './index.html',
  './style.css',
  './app.js',
  './drive.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './vaultkey-shield-scene.png?v=221'
];

const NO_CACHE_HOSTS = [
  'accounts.google.com',
  'oauth2.googleapis.com',
  'www.googleapis.com',
  'googleusercontent.com'
];

// ── Instalación: cachear todos los archivos ──────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

// ── Activación: limpiar cachés viejos + notificar clientes ───
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => clients.forEach(client =>
        client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION })
      ))
  );
});

// ── Fetch: estrategia por tipo de recurso ────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Nunca cachear peticiones a Google APIs
  if (NO_CACHE_HOSTS.some(host => url.hostname.includes(host))) return;

  // Nunca cachear peticiones con Authorization header
  if (event.request.headers.get('Authorization')) return;

  // index.html — Network first, caché como fallback
  if (url.pathname === '/' || url.pathname.endsWith('/vaultkey/') || url.pathname.endsWith('index.html')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          // Actualizar el caché con la versión nueva
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // app.js y style.css — Network first (para recibir actualizaciones)
  if (url.pathname.endsWith('app.js') || url.pathname.endsWith('style.css') || url.pathname.endsWith('drive.js')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Resto (iconos, manifest, imágenes) — Cache first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      });
    })
  );
});

// ── Mensajes desde la app ─────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'GET_VERSION') {
    event.source?.postMessage({ type: 'SW_VERSION', version: CACHE_VERSION });
  }
});

/* ════════════════════════════════════════════════════════════════════════
   SW.JS — RM Sistemas · Service Worker
   Cache-first para assets locais; network-first para os iframes externos.
════════════════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'rm-central-v1';

// Arquivos do próprio app que queremos manter em cache
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './logo-bg.png'
];

/* ── Instalação: pré-cacheia os assets locais ─────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // addAll falha silenciosamente se algum arquivo não existir ainda
      return Promise.allSettled(
        PRECACHE.map(url => cache.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

/* ── Ativação: limpa caches antigas ──────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: estratégia por tipo de recurso ───────────────────────────── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Requisições cross-origin (iframes dos sistemas, Firebase, fontes Google)
  // → sempre tenta a rede; sem cache para não interferir
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Assets locais → cache-first, com fallback para rede
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Só cacheia respostas válidas
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Fallback offline: retorna o index.html para navegação
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('', { status: 503 });
      });
    })
  );
});

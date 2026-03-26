// ============================================================
//  Service Worker — Baguette Chaussette
//  Stratégie :
//    • HTML  → Network First (toujours frais, cache en secours)
//    • Assets (CSS/JS/img/fonts) → Cache First (rapide)
// ============================================================

const CACHE_NAME = 'bc-v2';

const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/events.html',
    '/links.html',
    '/css/main.css',
    '/css/base.css',
    '/css/layout.css',
    '/css/components.css',
    '/css/sections.css',
    '/css/responsive.css',
    '/css/events.css',
    '/css/partners.css',
    '/css/lightbox.css',
    '/js/main.js',
    '/js/gallery.js',
    '/js/links.js',
    '/js/stream-countdown.js',
    '/js/fluent-emoji.js',
    '/img/baguette-chaussette-logo.webp',
    '/img/baguette-chaussette-streamer-twitch-fr-v2.webp',
    '/img/symbols/menu.svg',
    '/favicons/favicon-96x96.png',
    '/favicons/apple-touch-icon.png',
];

// ── Install : précache des assets principaux ──────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// ── Activate : purge des anciens caches ───────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

// ── Fetch ─────────────────────────────────────────────────
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Ignore les requêtes non-GET et cross-origin (Umami, Google Fonts, etc.)
    if (request.method !== 'GET' || url.origin !== location.origin) return;

    // Ignore le suivi analytics et les données temps-réel
    if (url.pathname.startsWith('/data/') || url.pathname.includes('followers')) return;

    const isHTML = request.headers.get('accept')?.includes('text/html');

    if (isHTML) {
        // Network First pour le HTML → contenu toujours à jour
        event.respondWith(
            fetch(request)
                .then(res => {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(request, clone));
                    return res;
                })
                .catch(() => caches.match(request))
        );
    } else {
        // Stale While Revalidate pour les assets statiques
        // → sert le cache immédiatement, met à jour en arrière-plan
        event.respondWith(
            caches.open(CACHE_NAME).then(cache =>
                cache.match(request).then(cached => {
                    const fetchPromise = fetch(request).then(res => {
                        cache.put(request, res.clone());
                        return res;
                    });
                    return cached || fetchPromise;
                })
            )
        );
    }
});

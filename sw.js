// ============================================================
//  Service Worker — Baguette Chaussette
//  Stratégie :
//    • HTML  → Network First (toujours frais, cache en secours)
//    • Assets (CSS/JS/img/fonts) → Cache First (rapide)
// ============================================================

const CACHE_NAME = 'bc-v8';

const PRECACHE_ASSETS = [
    // Une seule forme d'URL par page : celle utilisée par les liens internes
    '/',
    '/events',
    '/clips',
    '/links',
    '/mentions-legales',
    '/404.html',
    '/css/fonts.css',
    '/fonts/baloo2-latin.woff2',
    '/fonts/baloo2-latin-ext.woff2',
    '/css/base.css',
    '/css/layout.css',
    '/css/components.css',
    '/css/sections.css',
    '/css/responsive.css',
    '/css/events.css',
    '/css/partners.css',
    '/css/lightbox.css',
    '/css/links.css',
    '/css/mentions-legales.css',
    '/js/main.js',
    '/js/gallery.js',
    '/js/links.js',
    '/js/stream-countdown.js',
    '/js/live-float.js',
    '/js/clips-page.js',
    '/js/fluent-emoji.js',
    '/img/baguette-chaussette-logo.webp',
    '/img/baguette-chaussette-streamer-twitch-fr-v2.webp',
    '/img/symbols/menu.svg',
    '/img/symbols/close.svg',
    '/img/symbols/fullscreen.svg',
    '/img/symbols/arrow_back_ios.svg',
    '/img/symbols/arrow_forward_ios.svg',
    '/favicons/favicon-96x96.png',
    '/favicons/apple-touch-icon.png',
];

// ── Install : précache des assets principaux ──────────────
// allSettled : un fichier renommé/supprimé ne bloque pas toute l'installation
// (cache.addAll échouerait en tout-ou-rien et figerait le SW sur l'ancienne version)
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => Promise.allSettled(PRECACHE_ASSETS.map(a => cache.add(a))))
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
    if (url.pathname.startsWith('/data/')) return;

    const isHTML = request.headers.get('accept')?.includes('text/html');

    if (isHTML) {
        // Network First pour le HTML → contenu toujours à jour.
        // Seules les réponses saines sont mises en cache (jamais une 404/500 transitoire),
        // et hors-ligne une page inconnue retombe sur la 404 maison plutôt que sur
        // la page d'erreur du navigateur.
        event.respondWith(
            fetch(request)
                .then(res => {
                    if (res.ok) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then(c => c.put(request, clone));
                    }
                    return res;
                })
                .catch(() =>
                    caches.match(request).then(r => r || caches.match('/404.html'))
                )
        );
    } else {
        // Stale While Revalidate pour les assets statiques
        // → sert le cache immédiatement, met à jour en arrière-plan
        event.respondWith(
            caches.open(CACHE_NAME).then(cache =>
                cache.match(request).then(cached => {
                    const fetchPromise = fetch(request)
                        .then(res => {
                            if (res.ok) cache.put(request, res.clone());
                            return res;
                        })
                        .catch(() => cached); // offline : pas de rejet non géré dans la console
                    return cached || fetchPromise;
                })
            )
        );
    }
});

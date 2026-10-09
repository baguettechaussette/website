// Service Worker

const VERSION = 249;
const CACHE_NAME = `bc-v${VERSION}`;

const PRECACHE_ASSETS = [
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
    '/css/desktop-chrome.css',
    '/css/desktop.css',
    '/css/clips-desktop.css',
    '/css/events-desktop.css',
    '/css/lightbox.css',
    '/css/links.css',
    '/css/mentions-legales.css',
    '/js/main.js',
    '/js/gallery.js',
    '/js/links.js',
    '/js/stream-countdown.js',
    '/js/live-float.js',
    '/js/clips-page.js',
    '/js/gamers4pets.js',
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

// Install
const versioned = a => /\.(css|js)$/.test(a) ? `${a}?v=${VERSION}` : a;

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => Promise.allSettled(PRECACHE_ASSETS.map(a => cache.add(versioned(a)))))
            .then(() => self.skipWaiting())
    );
});

// Activate
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

// Fetch
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET' || url.origin !== location.origin) return;

    if (url.pathname.startsWith('/data/')) return;

    const isHTML = request.headers.get('accept')?.includes('text/html');

    if (isHTML) {
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
        event.respondWith(
            caches.open(CACHE_NAME).then(cache =>
                cache.match(request).then(cached => {
                    const fetchPromise = fetch(request)
                        .then(res => {
                            if (res.ok) cache.put(request, res.clone());
                            return res;
                        })
                        .catch(() => cached);
                    return cached || fetchPromise;
                })
            )
        );
    }
});

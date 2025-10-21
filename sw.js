const CACHE_VERSION = 'baguette-v1.2.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

// Pour GitHub Pages, détecte si on est sur un sous-dossier
const BASE_PATH = self.location.pathname.split('/').slice(0, -1).join('/') || '';

// Ressources à mettre en cache immédiatement
const STATIC_ASSETS = [
    `${BASE_PATH}/`,
    `${BASE_PATH}/index.html`,
    `${BASE_PATH}/css/main.css`,
    `${BASE_PATH}/js/main.js`,
    `${BASE_PATH}/js/stream-countdown.js`,
    `${BASE_PATH}/js/baguettectober.js`,
    `${BASE_PATH}/js/twitch-embed.js`,
    `${BASE_PATH}/img/baguette-chaussette-logo.webp`,
    `${BASE_PATH}/img/baguette-chaussette-streamer-twitch-fr.webp`,
    `${BASE_PATH}/favicons/favicon.svg`,
    `${BASE_PATH}/site.webmanifest`,
    'https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;600;700;800&display=swap'
];

// Installation du Service Worker
self.addEventListener('install', event => {
    console.log('🥖 Service Worker: Installation...');

    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('📦 Mise en cache des ressources statiques');
                return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })));
            })
            .then(() => self.skipWaiting())
            .catch(err => console.error('❌ Erreur lors du cache:', err))
    );
});

// Activation et nettoyage des anciens caches
self.addEventListener('activate', event => {
    console.log('✨ Service Worker: Activation');

    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name.startsWith('baguette-') && name !== STATIC_CACHE && name !== DYNAMIC_CACHE && name !== IMAGE_CACHE)
                        .map(name => {
                            console.log('🗑️ Suppression ancien cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Stratégie de cache
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Ignore les requêtes non-GET
    if (request.method !== 'GET') return;

    // Ignore les requêtes vers des domaines externes (sauf fonts et CDN)
    if (url.origin !== location.origin &&
        !url.origin.includes('fonts.googleapis.com') &&
        !url.origin.includes('fonts.gstatic.com') &&
        !url.origin.includes('cdnjs.cloudflare.com')) {
        return;
    }

    // Stratégie pour les images
    if (request.destination === 'image') {
        event.respondWith(cacheFirstStrategy(request, IMAGE_CACHE));
        return;
    }

    // Stratégie pour les fichiers statiques
    if (STATIC_ASSETS.some(asset => request.url.includes(asset))) {
        event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
        return;
    }

    // Stratégie Network First pour le reste (HTML, données dynamiques)
    event.respondWith(networkFirstStrategy(request));
});

// Cache First: Vérifie le cache d'abord, sinon réseau
async function cacheFirstStrategy(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    if (cached) {
        return cached;
    }

    try {
        const response = await fetch(request);
        if (response.status === 200) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        console.warn('📡 Échec réseau pour:', request.url);
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    }
}

// Network First: Réseau d'abord, cache en fallback
async function networkFirstStrategy(request) {
    try {
        const response = await fetch(request);

        if (response.status === 200) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, response.clone());
        }

        return response;
    } catch (error) {
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }

        // Page offline de secours
        if (request.destination === 'document') {
            return new Response(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Hors ligne - Baguette Chaussette</title>
          <style>
            body {
              margin: 0;
              padding: 0;
              font-family: 'Baloo 2', sans-serif;
              background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
              color: #fff;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              text-align: center;
            }
            .offline-container {
              padding: 2rem;
              max-width: 500px;
            }
            .offline-icon {
              font-size: 5rem;
              margin-bottom: 1rem;
              animation: float 3s ease-in-out infinite;
            }
            @keyframes float {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-20px); }
            }
            h1 {
              font-size: 2rem;
              margin: 1rem 0;
              background: linear-gradient(135deg, #9146ff, #ff6b9d);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
            }
            p {
              color: rgba(255, 255, 255, 0.7);
              font-size: 1.1rem;
              line-height: 1.6;
            }
            .btn {
              margin-top: 2rem;
              padding: 1rem 2rem;
              background: linear-gradient(135deg, #9146ff, #ff6b9d);
              border: none;
              border-radius: 50px;
              color: white;
              font-size: 1rem;
              font-weight: 600;
              cursor: pointer;
              text-decoration: none;
              display: inline-block;
              transition: transform 0.2s;
            }
            .btn:hover {
              transform: scale(1.05);
            }
          </style>
        </head>
        <body>
          <div class="offline-container">
            <div class="offline-icon">🥖</div>
            <h1>Tu es hors ligne !</h1>
            <p>Pas de connexion internet détectée. Vérifie ta connexion et réessaie.</p>
            <button class="btn" onclick="location.reload()">Réessayer</button>
          </div>
        </body>
        </html>
      `, {
                headers: { 'Content-Type': 'text/html' }
            });
        }

        return new Response('Offline', { status: 503 });
    }
}

// Messages depuis le client
self.addEventListener('message', event => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then(names => Promise.all(names.map(name => caches.delete(name))))
        );
    }
});

// Notifications Push (pour plus tard)
self.addEventListener('push', event => {
    const options = {
        body: event.data ? event.data.text() : '🔴 Un nouveau stream commence !',
        icon: '/favicons/web-app-manifest-192x192.png',
        badge: '/favicons/favicon-96x96.png',
        vibrate: [200, 100, 200],
        tag: 'baguette-notification',
        requireInteraction: false,
        actions: [
            { action: 'open', title: 'Rejoindre le stream' },
            { action: 'close', title: 'Plus tard' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('Baguette Chaussette 🥖', options)
    );
});

// Clic sur notification
self.addEventListener('notificationclick', event => {
    event.notification.close();

    if (event.action === 'open') {
        event.waitUntil(
            clients.openWindow('https://www.twitch.tv/baguettechaussette')
        );
    }
});

console.log('🥖 Service Worker chargé - Version:', CACHE_VERSION);
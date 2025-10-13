// ============================================
// AMÉLIORATIONS SUGGÉRÉES POUR LE SITE
// ============================================

/*
 * 1. SYSTÈME DE NOTIFICATION TOAST
 * Pour informer l'utilisateur quand le stream commence
 */
class StreamNotifier {
    constructor() {
        this.hasNotified = false;
        this.permission = 'default';
        this.init();
    }

    async init() {
        // Demande la permission pour les notifications
        if ('Notification' in window && Notification.permission === 'default') {
            // On attend que l'utilisateur interagisse avec la page
            document.addEventListener('click', async () => {
                if (this.permission === 'default') {
                    this.permission = await Notification.requestPermission();
                }
            }, { once: true });
        }
    }

    notify(title, body, icon = './img/logo.png') {
        if (this.hasNotified) return;

        // Toast notification dans la page
        this.showToast(title, body);

        // Notification système si autorisé
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body,
                icon,
                badge: icon,
                tag: 'stream-live',
                requireInteraction: true
            });
        }

        this.hasNotified = true;
    }

    showToast(title, body) {
        // Crée un toast moderne
        const toast = document.createElement('div');
        toast.className = 'stream-toast';
        toast.innerHTML = `
            <div class="stream-toast__icon">🔴</div>
            <div class="stream-toast__content">
                <div class="stream-toast__title">${title}</div>
                <div class="stream-toast__body">${body}</div>
            </div>
            <button class="stream-toast__close" aria-label="Fermer">×</button>
        `;

        document.body.appendChild(toast);

        // Animation d'entrée
        setTimeout(() => toast.classList.add('is-visible'), 100);

        // Fermeture
        const close = () => {
            toast.classList.remove('is-visible');
            setTimeout(() => toast.remove(), 300);
        };

        toast.querySelector('.stream-toast__close').addEventListener('click', close);
        setTimeout(close, 10000); // Auto-fermeture après 10s
    }

    reset() {
        this.hasNotified = false;
    }
}

/*
 * 2. DÉTECTION DE STREAM EN DIRECT VIA API TWITCH
 * (Nécessite une clé API côté serveur pour éviter l'exposition)
 */
class TwitchStreamChecker {
    constructor(channelName) {
        this.channelName = channelName;
        this.isLive = false;
        this.checkInterval = null;
    }

    async checkIfLive() {
        try {
            // Appel à votre backend qui interroge l'API Twitch
            const response = await fetch(`/api/twitch/stream-status?channel=${this.channelName}`);
            const data = await response.json();

            const wasLive = this.isLive;
            this.isLive = data.isLive;

            // Si le stream vient de démarrer
            if (this.isLive && !wasLive) {
                this.onStreamStart(data);
            }

            // Si le stream vient de se terminer
            if (!this.isLive && wasLive) {
                this.onStreamEnd();
            }

            return this.isLive;
        } catch (error) {
            console.warn('Impossible de vérifier le statut du stream:', error);
            return false;
        }
    }

    startChecking(intervalMs = 60000) {
        // Vérifie toutes les minutes
        this.checkIfLive();
        this.checkInterval = setInterval(() => this.checkIfLive(), intervalMs);
    }

    stopChecking() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    onStreamStart(data) {
        console.log('🎮 Stream démarré!', data);
        // Déclencher une notification
        window.streamNotifier?.notify(
            '🔴 Baguette Chaussette est en LIVE !',
            `${data.game || 'Gaming'} - Rejoins le stream maintenant !`
        );
    }

    onStreamEnd() {
        console.log('Stream terminé');
    }
}

/*
 * 3. COMPTEUR DE VIEWERS EN TEMPS RÉEL
 * Affiche le nombre de viewers actuels
 */
function initViewerCount() {
    const viewerBadge = document.createElement('div');
    viewerBadge.className = 'viewer-count-badge';
    viewerBadge.innerHTML = `
        <span class="viewer-count-icon">👥</span>
        <span class="viewer-count-number" id="viewerCount">-</span>
    `;

    const liveSection = document.querySelector('.live-indicator');
    if (liveSection) {
        liveSection.parentElement.insertBefore(viewerBadge, liveSection.nextSibling);
    }
}

async function updateViewerCount() {
    try {
        const response = await fetch('/api/twitch/viewer-count?channel=baguettechaussette');
        const data = await response.json();

        const el = document.getElementById('viewerCount');
        if (el && data.viewers !== undefined) {
            el.textContent = data.viewers.toLocaleString('fr-FR');
        }
    } catch (error) {
        console.warn('Impossible de récupérer le nombre de viewers:', error);
    }
}

/*
 * 4. SYSTÈME DE THÈME CLAIR/SOMBRE
 * Permet aux utilisateurs de choisir leur thème
 */
class ThemeManager {
    constructor() {
        this.theme = localStorage.getItem('theme') || 'dark';
        this.init();
    }

    init() {
        document.documentElement.setAttribute('data-theme', this.theme);
        this.createToggle();
    }

    createToggle() {
        const toggle = document.createElement('button');
        toggle.className = 'theme-toggle';
        toggle.setAttribute('aria-label', 'Changer de thème');
        toggle.innerHTML = this.theme === 'dark' ? '☀️' : '🌙';

        toggle.addEventListener('click', () => this.toggle());

        // Ajoute le bouton dans la navbar
        const nav = document.querySelector('nav .container');
        if (nav) {
            nav.appendChild(toggle);
        }
    }

    toggle() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', this.theme);
        localStorage.setItem('theme', this.theme);

        // Met à jour l'icône
        const toggle = document.querySelector('.theme-toggle');
        if (toggle) {
            toggle.innerHTML = this.theme === 'dark' ? '☀️' : '🌙';
        }
    }
}

/*
 * 5. LAZY LOADING AMÉLIORÉ POUR LES IMAGES
 * Charge les images de manière optimale
 */
function initLazyLoading() {
    const images = document.querySelectorAll('img[data-src]');

    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                observer.unobserve(img);

                // Ajoute une classe pour l'animation
                img.classList.add('lazy-loaded');
            }
        });
    }, {
        rootMargin: '50px' // Charge 50px avant que l'image soit visible
    });

    images.forEach(img => imageObserver.observe(img));
}

/*
 * 6. PARTAGE SUR LES RÉSEAUX SOCIAUX
 * Facilite le partage du stream
 */
function initShareButtons() {
    const shareData = {
        title: 'Baguette Chaussette - Streamer FR',
        text: 'Rejoins-moi en live sur Twitch ! 🥖🧦',
        url: 'https://www.twitch.tv/baguettechaussette'
    };

    // Bouton de partage natif (si supporté)
    const shareButton = document.createElement('button');
    shareButton.className = 'share-button';
    shareButton.innerHTML = '📤 Partager';
    shareButton.setAttribute('aria-label', 'Partager le stream');

    shareButton.addEventListener('click', async () => {
        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                console.log('Partage annulé');
            }
        } else {
            // Fallback : copier le lien
            navigator.clipboard.writeText(shareData.url);
            showCopyFeedback(shareButton);
        }
    });

    const liveContainer = document.querySelector('.live-container');
    if (liveContainer) {
        liveContainer.insertBefore(shareButton, liveContainer.firstChild);
    }
}

function showCopyFeedback(button) {
    const originalText = button.innerHTML;
    button.innerHTML = '✅ Lien copié !';
    button.classList.add('success');

    setTimeout(() => {
        button.innerHTML = originalText;
        button.classList.remove('success');
    }, 2000);
}

/*
 * 7. STATS EN TEMPS RÉEL ANIMÉES
 * Anime les statistiques au scroll
 */
function animateStatsOnScroll() {
    const stats = document.querySelectorAll('.stat-number');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.dataset.animated) {
                entry.target.dataset.animated = 'true';
                animateStat(entry.target);
            }
        });
    }, { threshold: 0.5 });

    stats.forEach(stat => observer.observe(stat));
}

function animateStat(element) {
    const text = element.textContent;
    const match = text.match(/(\d+)/);

    if (match) {
        const target = parseInt(match[1]);
        const duration = 2000;
        const start = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - start;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function (easeOutExpo)
            const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
            const current = Math.floor(eased * target);

            element.textContent = text.replace(/\d+/, current.toLocaleString('fr-FR'));

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                element.textContent = text.replace(/\d+/, target.toLocaleString('fr-FR'));
            }
        }

        requestAnimationFrame(update);
    }
}

/*
 * 8. SYSTÈME DE CACHE INTELLIGENT POUR LES DONNÉES
 * Évite les appels API inutiles
 */
class CacheManager {
    constructor(maxAge = 5 * 60 * 1000) { // 5 minutes par défaut
        this.cache = new Map();
        this.maxAge = maxAge;
    }

    set(key, value) {
        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
    }

    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;

        const age = Date.now() - item.timestamp;
        if (age > this.maxAge) {
            this.cache.delete(key);
            return null;
        }

        return item.value;
    }

    has(key) {
        return this.get(key) !== null;
    }

    clear() {
        this.cache.clear();
    }
}

/*
 * 9. AMÉLIORATION DU CHARGEMENT DES FOLLOWERS
 * Avec cache et fallback élégant
 */
const apiCache = new CacheManager(2 * 60 * 1000); // 2 minutes

async function loadFollowersCountImproved(retries = 3) {
    const el = document.getElementById('followersCount');
    if (!el) return;

    // Vérifie le cache d'abord
    if (apiCache.has('followers')) {
        const cached = apiCache.get('followers');
        animateCounter(el, 0, cached, 1500);
        return;
    }

    // Indicateur de chargement
    el.textContent = '...';
    el.style.opacity = '0.7';

    for (let i = 0; i < retries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

            const response = await fetch('data/followers.json', {
                cache: 'no-store',
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });

            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();

            if (Number.isFinite(data.followers) && data.followers > 0) {
                apiCache.set('followers', data.followers);
                animateCounter(el, 0, data.followers, 1500);
                el.style.opacity = '1';
                return;
            } else {
                throw new Error('Invalid followers data');
            }
        } catch (err) {
            console.warn(`Tentative ${i + 1}/${retries}:`, err.message);

            if (i === retries - 1) {
                // Dernière tentative échouée
                el.textContent = '200+'; // Fallback élégant
                el.style.opacity = '0.6';
            } else {
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    }
}

/*
 * 10. SCROLL TO TOP BUTTON
 * Bouton pour remonter en haut de page
 */
function initScrollToTop() {
    const button = document.createElement('button');
    button.className = 'scroll-to-top';
    button.setAttribute('aria-label', 'Retour en haut');
    button.innerHTML = `
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
       xmlns="http://www.w3.org/2000/svg">
    <path d="M12 19V5M12 5L6 11M12 5L18 11"
          stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
 document.body.appendChild(button);

    let isVisible = false;

    function toggleVisibility() {
        const shouldShow = window.pageYOffset > 500;

        if (shouldShow && !isVisible) {
            button.classList.add('is-visible');
            isVisible = true;
        } else if (!shouldShow && isVisible) {
            button.classList.remove('is-visible');
            isVisible = false;
        }
    }

    // Throttle pour performances
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                toggleVisibility();
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });

    button.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

/*
 * 11. EASTER EGG - KONAMI CODE
 * Pour les fans 🎮
 */
function initKonamiCode() {
    const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
        'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
        'b', 'a'];
    let position = 0;

    document.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();

        if (key === konamiCode[position].toLowerCase()) {
            position++;

            if (position === konamiCode.length) {
                triggerEasterEgg();
                position = 0;
            }
        } else {
            position = 0;
        }
    });
}

function triggerEasterEgg() {
    // Effet visuel fun
    document.body.style.animation = 'rainbow 2s ease-in-out';

    // Affiche un message
    const message = document.createElement('div');
    message.className = 'easter-egg-message';
    message.textContent = '🥖 Tu as trouvé la baguette secrète ! 🧦';
    document.body.appendChild(message);

    setTimeout(() => message.classList.add('visible'), 500);

    setTimeout(() => {
        message.classList.remove('visible');
        setTimeout(() => message.remove(), 5000);
        document.body.style.animation = '';
    }, 3000);
}

/*
 * 12. DÉTECTION DE CONNEXION RÉSEAU
 * Informe l'utilisateur en cas de problème
 */
function initNetworkDetection() {
    let wasOffline = false;

    function updateOnlineStatus() {
        const isOnline = navigator.onLine;

        if (!isOnline && !wasOffline) {
            showNetworkToast('⚠️ Connexion perdue', 'Vérifiez votre connexion internet', 'warning');
            wasOffline = true;
        } else if (isOnline && wasOffline) {
            showNetworkToast('✅ Connexion rétablie', 'Vous êtes de nouveau en ligne', 'success');
            wasOffline = false;

            // Recharge les données importantes
            loadFollowersCountImproved();
        }
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
}

function showNetworkToast(title, message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `network-toast network-toast--${type}`;
    toast.innerHTML = `
        <div class="network-toast__content">
            <div class="network-toast__title">${title}</div>
            <div class="network-toast__message">${message}</div>
        </div>
    `;

    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('is-visible'), 100);

    setTimeout(() => {
        toast.classList.remove('is-visible');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

/*
 * 13. PERFORMANCE MONITORING
 * Surveille les performances de la page
 */
function initPerformanceMonitoring() {
    if ('PerformanceObserver' in window) {
        // Observe les métriques Web Vitals
        try {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    // Log des métriques importantes
                    if (entry.entryType === 'largest-contentful-paint') {
                        console.log('LCP:', entry.renderTime || entry.loadTime);
                    }
                    if (entry.entryType === 'first-input') {
                        console.log('FID:', entry.processingStart - entry.startTime);
                    }
                    if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
                        console.log('CLS:', entry.value);
                    }
                }
            });

            observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
        } catch (e) {
            console.warn('Performance monitoring non disponible');
        }
    }
}

/*
 * 14. PRÉCHARGEMENT INTELLIGENT
 * Précharge les ressources importantes
 */
function preloadCriticalResources() {
    const criticalImages = [
        './img/logo.png',
        // Ajouter d'autres images critiques
    ];

    criticalImages.forEach(src => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = src;
        document.head.appendChild(link);
    });
}

/*
 * 15. INITIALISATION GLOBALE
 * Lance tous les systèmes au chargement
 */
document.addEventListener('DOMContentLoaded', () => {
    // Systèmes de base
    window.streamNotifier = new StreamNotifier();
    window.twitchChecker = new TwitchStreamChecker('baguettechaussette');

    // Lance la vérification du stream toutes les 2 minutes
    // window.twitchChecker.startChecking(120000);

    // Thème
    // window.themeManager = new ThemeManager();

    // Fonctionnalités visuelles
    initScrollToTop();
    animateStatsOnScroll();

    // Fonctionnalités réseau
    initNetworkDetection();
    loadFollowersCountImproved();

    // Easter eggs et fun
    initKonamiCode();

    // Performance
    preloadCriticalResources();
    initPerformanceMonitoring();

    // Lazy loading
    if ('IntersectionObserver' in window) {
        initLazyLoading();
    }

    console.log('🥖 Baguette Chaussette - Site chargé avec succès! 🧦');
});

/*
 * 16. SERVICE WORKER (OPTIONNEL)
 * Pour PWA et cache offline
 */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Décommenter pour activer le Service Worker
        // navigator.serviceWorker.register('/sw.js')
        //     .then(reg => console.log('Service Worker enregistré'))
        //     .catch(err => console.warn('Service Worker échoué:', err));
    });
}
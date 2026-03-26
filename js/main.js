// Toggle mobile menu avec gestion améliorée
function toggleMenu() {
    const navLinks = document.getElementById('navLinks');
    const menuToggle = document.querySelector('.menu-toggle');

    if (navLinks) {
        const isOpen = navLinks.classList.toggle('active');

        // Amélioration a11y
        if (menuToggle) {
            menuToggle.setAttribute('aria-expanded', isOpen);
            menuToggle.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
        }

        // Empêche le scroll du body quand le menu est ouvert sur mobile
        if (window.innerWidth <= 768) {
            document.body.style.overflow = isOpen ? 'hidden' : '';
        }
    }
}

// Ferme le menu au clic en dehors
document.addEventListener('click', (e) => {
    const navLinks = document.getElementById('navLinks');
    const menuToggle = document.querySelector('.menu-toggle');
    const navbar = document.getElementById('navbar');

    if (navLinks && navLinks.classList.contains('active') &&
        !navbar.contains(e.target)) {
        navLinks.classList.remove('active');
        document.body.style.overflow = '';
        if (menuToggle) {
            menuToggle.setAttribute('aria-expanded', 'false');
        }
    }
});

// Smooth scroll pour les liens d'ancres
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
        const href = anchor.getAttribute('href');

        // Ignore les liens vides
        if (href === '#') {
            e.preventDefault();
            return;
        }

        const target = document.querySelector(href);

        if (target) {
            e.preventDefault();

            // Ferme le menu mobile si ouvert
            const navLinks = document.getElementById('navLinks');
            if (navLinks) {
                navLinks.classList.remove('active');
                document.body.style.overflow = '';
            }

            // Scroll avec offset pour la navbar fixe
            const navbarHeight = document.getElementById('navbar')?.offsetHeight || 80;
            const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - navbarHeight;

            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// Navbar scroll effect avec debounce
let scrollTimer;
window.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);

    scrollTimer = setTimeout(() => {
        const navbar = document.getElementById('navbar');
        if (navbar) {
            navbar.classList.toggle('scrolled', window.scrollY > 50);
        }
    }, 10);
}, { passive: true });

// Animation du compteur (pour les stats)
function animateCounter(element, start, end, duration, suffix = '') {
    const startTime = performance.now();
    const range = end - start;

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing: easeOutQuad
        const easeProgress = 1 - Math.pow(1 - progress, 2);
        const current = Math.floor(start + range * easeProgress);

        element.textContent = current.toLocaleString('fr-FR') + suffix;

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = end.toLocaleString('fr-FR') + suffix;
        }
    }

    requestAnimationFrame(update);
}

// Injection du nombre de followers avec retry et gestion d'erreurs
async function loadFollowersCount(retries = 3) {
    const el = document.getElementById('followersCount');
    if (!el) return;

    // Indicateur de chargement
    el.textContent = '...';
    el.style.opacity = '0.7';

    for (let i = 0; i < retries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch('data/followers.json', {
                cache: 'no-store',
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (Number.isFinite(data.followers) && data.followers > 0) {
                // Animation du compteur
                el.style.opacity = '1';
                animateCounter(el, 0, data.followers, 1500);
                return;
            } else {
                throw new Error('Invalid followers count');
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                console.warn(`Tentative ${i + 1}/${retries}: Timeout`);
            } else {
                console.warn(`Tentative ${i + 1}/${retries}:`, err.message);
            }

            if (i === retries - 1) {
                // Dernière tentative - fallback avec animation
                el.style.opacity = '1';
                el.title = 'Données temporairement indisponibles';
                animateCounter(el, 0, 1000, 1200);
                setTimeout(() => { el.textContent = '1K+'; }, 1250);
            } else {
                // Attendre avant de réessayer (backoff exponentiel)
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    }
}

// Gestion du resize avec debounce
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);

    resizeTimer = setTimeout(() => {
        const navLinks = document.getElementById('navLinks');

        // Réinitialise le menu sur desktop
        if (window.innerWidth > 768 && navLinks) {
            navLinks.classList.remove('active');
            document.body.style.overflow = '';
        }
    }, 250);
}, { passive: true });

// Animations au défilement (Intersection Observer)
function initScrollReveal() {
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

    // Éléments simples (fade-up sans stagger)
    [
        // index.html
        '.section-header',
        '.contact-info-box',
        '.next-stream-banner',
        // events.html
        '.event-intro',
        '.event-stats-strip',
        '.event-podium-section',
        '.dti-gallery-block',
        '.dti-section-title',
    ].forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
            el.classList.add('scroll-reveal');
            observer.observe(el);
        });
    });

    // Éléments avec stagger (par groupe parent)
    [
        // index.html
        { parent: '.schedule-grid',        child: '.schedule-item',       delay: 0.10 },
        { parent: '.events-archive-grid',  child: '.event-archive-card',  delay: 0.07 },
        { parent: '.contact-cards',        child: '.contact-card',        delay: 0.10 },
        { parent: '.partners-container',   child: '.partner-card',        delay: 0.12 },
        { parent: '.social-grid',          child: '.social-card',         delay: 0.07 },
        // events.html
        { parent: '.event-stats-strip',                  child: '.event-stat-chip', delay: 0.07 },
        { parent: '.event-podium',                       child: '.podium-card',     delay: 0.10 },
        { parent: '.dti-photo-grid',                     child: '.dti-photo-item',  delay: 0.05 },
        { parent: '#baguettectober-2025 .gallery-grid',  child: '.gallery-item',    delay: 0.07 },
    ].forEach(({ parent, child, delay }) => {
        document.querySelectorAll(parent).forEach(parentEl => {
            parentEl.querySelectorAll(child).forEach((el, i) => {
                el.classList.add('scroll-reveal');
                el.style.setProperty('--sr-delay', `${i * delay}s`);
                observer.observe(el);
            });
        });
    });
}

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', () => {
    // Charge les followers
    loadFollowersCount();
    animateStaticCounters();
    initScrollReveal();

    // Ajoute les attributs ARIA manquants
    const menuToggle = document.querySelector('.menu-toggle');
    if (menuToggle) {
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.setAttribute('aria-controls', 'navLinks');
    }

    // Année dynamique dans le footer
    const yearEl = document.getElementById('footer-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
});

// Gestion des erreurs globales (pour debug)
window.addEventListener('error', (event) => {
    // Ne log que les erreurs importantes, pas les warnings
    if (event.message && !event.message.includes('ResizeObserver')) {
        console.error('Erreur:', event.message, 'Fichier:', event.filename, 'Ligne:', event.lineno);
    }
});


// Animation des autres compteurs statiques
function animateStaticCounters() {
    [
        '.stat-box:nth-child(2) .stat-number', // TikTok
        '.stat-box:nth-child(3) .stat-number', // Heures de stream
    ].forEach(selector => {
        const el = document.querySelector(selector);
        if (!el) return;
        const target = parseInt(el.textContent.replace(/\D/g, '')) || 0;
        el.textContent = '0';
        el.style.opacity = '1';
        animateCounter(el, 0, target, 1200, '+');
    });
}


// Back to top button
(function () {
    const btn = document.getElementById('backToTop');
    if (!btn) return;

    const threshold = 400;

    window.addEventListener('scroll', () => {
        if (window.scrollY > threshold) {
            btn.classList.add('visible');
        } else {
            btn.classList.remove('visible');
        }
    }, { passive: true });

    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
})();

// Expose les fonctions pour usage externe si nécessaire
window.BaguetteChaussette = {
    toggleMenu,
    loadFollowersCount,
    animateCounter
};

// ── Service Worker ────────────────────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .catch(err => console.warn('SW:', err));
    });
}
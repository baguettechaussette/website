// ============================================
// MAIN.JS - Version corrigée et optimisée
// ============================================

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
function animateCounter(element, start, end, duration) {
    const startTime = performance.now();
    const range = end - start;

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing: easeOutQuad
        const easeProgress = 1 - Math.pow(1 - progress, 2);
        const current = Math.floor(start + range * easeProgress);

        element.textContent = current.toLocaleString('fr-FR');

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = end.toLocaleString('fr-FR');
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
                // Dernière tentative - fallback élégant
                el.textContent = '1K+';
                el.style.opacity = '0.6';
                el.title = 'Données temporairement indisponibles';
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

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', () => {
    // Charge les followers
    loadFollowersCount();

    // Ajoute les attributs ARIA manquants
    const menuToggle = document.querySelector('.menu-toggle');
    if (menuToggle) {
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.setAttribute('aria-controls', 'navLinks');
    }

    // Log de démarrage
    console.log('🥖 Baguette Chaussette - Scripts principaux chargés');
});

// Gestion de la visibilité de la page
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        // La page redevient visible - recharge les données si nécessaire
        const el = document.getElementById('followersCount');
        if (el && el.textContent === '1K+') {
            loadFollowersCount();
        }
    }
});

// Gestion des erreurs globales (pour debug)
window.addEventListener('error', (event) => {
    // Ne log que les erreurs importantes, pas les warnings
    if (event.message && !event.message.includes('ResizeObserver')) {
        console.error('Erreur:', event.message, 'Fichier:', event.filename, 'Ligne:', event.lineno);
    }
});

// Expose les fonctions pour usage externe si nécessaire
window.BaguetteChaussette = {
    toggleMenu,
    loadFollowersCount,
    animateCounter
};
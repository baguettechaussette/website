// Modal management (sémantique dialog + focus géré, même pattern que gallery.js)
let modalLastFocus = null;

function openModal(id) {
    const modal = document.getElementById('modal' + id.charAt(0).toUpperCase() + id.slice(1));
    if (modal) {
        modalLastFocus = document.activeElement;
        modal.classList.add('active');
        document.body.classList.add('modal-open');
        modal.querySelector('.modal-close')?.focus({ preventScroll: true });
    }
}

function closeModal(id) {
    const modal = document.getElementById('modal' + id.charAt(0).toUpperCase() + id.slice(1));
    if (modal) {
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
        modalLastFocus?.focus({ preventScroll: true });
        modalLastFocus = null;
    }
}

function closeAllModals() {
    const wasOpen = document.querySelector('.modal-overlay.active');
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    document.body.classList.remove('modal-open');
    if (wasOpen) {
        modalLastFocus?.focus({ preventScroll: true });
        modalLastFocus = null;
    }
}

// Ouverture/fermeture par délégation : les attributs data-modal-open / data-modal-close
// remplacent les onclick inline (incompatibles avec la Content-Security-Policy)
document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-modal-open]');
    if (opener) {
        openModal(opener.dataset.modalOpen);
        return;
    }
    const closer = e.target.closest('[data-modal-close]');
    if (closer) {
        closeModal(closer.dataset.modalClose);
        return;
    }
    // Clic sur le fond assombri
    if (e.target.classList.contains('modal-overlay') && e.target.classList.contains('active')) {
        closeAllModals();
    }
});

// Escape ferme la modale (avec retour du focus), Tab reste piégé à l'intérieur
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeAllModals();
    }

    if (e.key === 'Tab') {
        const modal = document.querySelector('.modal-overlay.active');
        if (!modal) return;
        const focusables = Array.from(modal.querySelectorAll('button, a[href]'));
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!modal.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
        } else if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }
});

// Rôles ARIA posés au chargement (évite de dupliquer les attributs dans les 5 modales)
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.modal-overlay').forEach((overlay, i) => {
        const content = overlay.querySelector('.modal-content');
        const title = overlay.querySelector('.modal-title');
        if (!content) return;
        content.setAttribute('role', 'dialog');
        content.setAttribute('aria-modal', 'true');
        if (title) {
            if (!title.id) title.id = 'modalTitle' + i;
            content.setAttribute('aria-labelledby', title.id);
        }
    });
});

// Live status check (poll toutes les 30s, comme sur l'accueil)
async function checkLiveStatus() {
    try {
        const response = await fetch('/data/live-status.json', {
            cache: 'no-store',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) return;

        const data = await response.json();

        const badge = document.getElementById('liveBadge');
        if (badge) {
            badge.classList.toggle('visible', !!data.is_live);
        }
    } catch (error) {
        console.debug('Live status check failed:', error.message);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    checkLiveStatus();
    setInterval(() => {
        if (!document.hidden) checkLiveStatus();
    }, 30_000);

    const yearEl = document.getElementById('footer-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // Emails assemblés côté client (anti-bots spam)
    document.querySelectorAll('.js-email').forEach(el => {
        const addr = `${el.dataset.user}@${el.dataset.domain}`;
        el.setAttribute('href', 'mailto:' + addr);
        if ('showText' in el.dataset) el.textContent = addr;
    });
});
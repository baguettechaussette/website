// Modal management
function openModal(id) {
    const modal = document.getElementById('modal' + id.charAt(0).toUpperCase() + id.slice(1));
    if (modal) {
        modal.classList.add('active');
        document.body.classList.add('modal-open');
    }
}

function closeModal(id) {
    const modal = document.getElementById('modal' + id.charAt(0).toUpperCase() + id.slice(1));
    if (modal) {
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
    }
}

function closeModalOnBackdrop(event, id) {
    if (event.target.classList.contains('modal-overlay')) {
        closeModal(id);
    }
}
// Escape key to close modals
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(modal => {
            modal.classList.remove('active');
        });
        document.body.classList.remove('modal-open');
    }
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
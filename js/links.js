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

// Umami tracking
function umamiTrack(event) {
    if (window.umami) {
        window.umami.track(event);
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

// Live status check
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

        if (data.is_live) {
            const badge = document.getElementById('liveBadge');
            if (badge) {
                badge.classList.add('visible');
            }

            const twitchCard = document.querySelector('.link-card.twitch');
            if (twitchCard) {
                const desc = twitchCard.querySelector('.link-desc');
                if (desc) {
                    desc.textContent = '🔴 EN DIRECT MAINTENANT — rejoins le stream !';
                }
            }
        }
    } catch (error) {
        console.debug('Live status check failed:', error.message);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    checkLiveStatus();
    console.log('🥖 Baguette Chaussette Links - Initialized');
});
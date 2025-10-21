// Installation et gestion de la PWA
(function initPWA() {
    let deferredPrompt = null;
    let isInstalled = false;

    // Vérifie si l'app est déjà installée
    if (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true) {
        isInstalled = true;
        document.body.classList.add('is-pwa');
    }

    // Enregistrement du Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', async () => {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/'
                });

                console.log('✅ Service Worker enregistré:', registration.scope);

                // Vérifie les mises à jour toutes les heures
                setInterval(() => {
                    registration.update();
                }, 3600000);

                // Gestion des mises à jour
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            showUpdateNotification(newWorker);
                        }
                    });
                });

            } catch (error) {
                console.error('❌ Erreur Service Worker:', error);
            }
        });
    }

    // Capture l'événement d'installation
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;

        if (!isInstalled) {
            showInstallButton();
        }
    });

    // Détecte l'installation réussie
    window.addEventListener('appinstalled', () => {
        console.log('🎉 PWA installée avec succès !');
        isInstalled = true;
        deferredPrompt = null;
        hideInstallButton();

        // Analytics ou événement personnalisé
        if (window.gtag) {
            gtag('event', 'pwa_installed', {
                event_category: 'engagement'
            });
        }
    });

    // Affiche le bouton d'installation
    function showInstallButton() {
        const existingBtn = document.getElementById('pwa-install-btn');
        if (existingBtn) return;

        const installBtn = document.createElement('button');
        installBtn.id = 'pwa-install-btn';
        installBtn.className = 'pwa-install-btn';
        installBtn.innerHTML = `
      <span class="pwa-install-icon">📱</span>
      <span class="pwa-install-text">Installer l'app</span>
    `;

        installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;

            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;

            console.log(`Installation: ${outcome}`);

            if (outcome === 'accepted') {
                hideInstallButton();
            }

            deferredPrompt = null;
        });

        // Ajoute le bouton dans le hero
        const heroButtons = document.querySelector('.hero-buttons');
        if (heroButtons) {
            heroButtons.appendChild(installBtn);
        }

        // Animation d'apparition
        setTimeout(() => installBtn.classList.add('show'), 100);
    }

    function hideInstallButton() {
        const btn = document.getElementById('pwa-install-btn');
        if (btn) {
            btn.classList.remove('show');
            setTimeout(() => btn.remove(), 300);
        }
    }

    // Notification de mise à jour
    function showUpdateNotification(worker) {
        const notification = document.createElement('div');
        notification.className = 'pwa-update-notification';
        notification.innerHTML = `
      <div class="pwa-update-content">
        <span class="pwa-update-icon">🔄</span>
        <div class="pwa-update-text">
          <strong>Nouvelle version disponible !</strong>
          <p>Clique pour mettre à jour</p>
        </div>
      </div>
      <button class="pwa-update-btn" id="pwa-update-btn">Mettre à jour</button>
      <button class="pwa-update-close" id="pwa-update-close" aria-label="Fermer">✕</button>
    `;

        document.body.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 100);

        // Bouton de mise à jour
        document.getElementById('pwa-update-btn').addEventListener('click', () => {
            worker.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
        });

        // Bouton de fermeture
        document.getElementById('pwa-update-close').addEventListener('click', () => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        });
    }

    // Gestion du mode hors ligne
    window.addEventListener('online', () => {
        showConnectionStatus('online');
    });

    window.addEventListener('offline', () => {
        showConnectionStatus('offline');
    });

    function showConnectionStatus(status) {
        const toast = document.createElement('div');
        toast.className = `connection-toast ${status}`;
        toast.innerHTML = status === 'online'
            ? '✅ Connexion rétablie !'
            : '📡 Mode hors ligne';

        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 100);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Fonction pour partager via Web Share API
    window.shareBaguette = async function() {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Baguette Chaussette',
                    text: 'Streamer Twitch FR - Gaming cosy & humour décalé ! 🥖',
                    url: 'https://baguettechaussette.fr'
                });
                console.log('✅ Partagé avec succès');
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('❌ Erreur de partage:', err);
                }
            }
        } else {
            // Fallback: copier le lien
            await navigator.clipboard.writeText('https://baguettechaussette.fr');
            showToast('🔗 Lien copié !');
        }
    };

    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'simple-toast';
        toast.textContent = message;

        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 100);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    // Ajoute bouton de partage dans le hero
    function addShareButton() {
        if (!navigator.share && !navigator.clipboard) return;

        const shareBtn = document.createElement('button');
        shareBtn.className = 'btn btn-share';
        shareBtn.innerHTML = '📤 Partager';
        shareBtn.onclick = window.shareBaguette;

        const heroButtons = document.querySelector('.hero-buttons');
        if (heroButtons) {
            heroButtons.appendChild(shareBtn);
        }
    }

    // Initialisation finale
    window.addEventListener('DOMContentLoaded', () => {
        addShareButton();

        // Log pour debug
        console.log('🥖 PWA Features:', {
            serviceWorker: 'serviceWorker' in navigator,
            notifications: 'Notification' in window,
            share: 'share' in navigator,
            standalone: isInstalled
        });
    });
})();
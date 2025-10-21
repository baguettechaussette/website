// Système de notifications push pour les streams
(function initNotifications() {
  const NOTIFICATION_PERMISSION_KEY = 'baguette_notification_permission';
  const NOTIFICATION_SHOWN_KEY = 'baguette_notification_shown';

  // Vérifie si les notifications sont supportées
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    console.log('❌ Notifications non supportées');
    return;
  }

  // Affiche la demande de permission après 30 secondes
  setTimeout(() => {
    if (Notification.permission === 'default') {
      showNotificationPrompt();
    }
  }, 30000);

  // Demande de permission élégante
  function showNotificationPrompt() {
    const alreadyShown = localStorage.getItem(NOTIFICATION_SHOWN_KEY);
    if (alreadyShown) return;

    const banner = document.createElement('div');
    banner.className = 'notification-prompt';
    banner.innerHTML = `
      <div class="notification-prompt-content">
        <div class="notification-prompt-icon">🔔</div>
        <div class="notification-prompt-text">
          <strong>Ne rate plus aucun stream !</strong>
          <p>Reçois une notification quand je suis en live</p>
        </div>
      </div>
      <div class="notification-prompt-actions">
        <button class="notification-btn notification-btn-accept" id="notif-accept">
          Activer les notifications
        </button>
        <button class="notification-btn notification-btn-decline" id="notif-decline">
          Plus tard
        </button>
      </div>
    `;

    document.body.appendChild(banner);
    setTimeout(() => banner.classList.add('show'), 100);

    // Bouton accepter
    document.getElementById('notif-accept').addEventListener('click', async () => {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        await subscribeUserToPush();
        showConfirmationToast('✅ Notifications activées !');
        localStorage.setItem(NOTIFICATION_PERMISSION_KEY, 'granted');
      } else {
        showConfirmationToast('❌ Notifications refusées');
      }
      
      localStorage.setItem(NOTIFICATION_SHOWN_KEY, 'true');
      closeBanner(banner);
    });

    // Bouton refuser
    document.getElementById('notif-decline').addEventListener('click', () => {
      localStorage.setItem(NOTIFICATION_SHOWN_KEY, 'true');
      closeBanner(banner);
    });

    // Auto-fermeture après 15 secondes
    setTimeout(() => {
      if (banner.parentNode) {
        closeBanner(banner);
      }
    }, 15000);
  }

  function closeBanner(banner) {
    banner.classList.remove('show');
    setTimeout(() => banner.remove(), 300);
  }

  // S'abonner aux notifications push
  async function subscribeUserToPush() {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Clé VAPID publique (à générer avec web-push)
      // Pour l'instant, on simule juste l'inscription
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          'VOTRE_CLE_VAPID_PUBLIQUE_ICI' // À remplacer par ta vraie clé
        )
      });

      // Envoie l'abonnement au serveur (à implémenter)
      console.log('📬 Abonnement push:', JSON.stringify(subscription));
      
      // Ici tu enverrais subscription à ton backend
      // await fetch('/api/subscribe', {
      //   method: 'POST',
      //   body: JSON.stringify(subscription),
      //   headers: { 'Content-Type': 'application/json' }
      // });

      return subscription;
    } catch (error) {
      console.error('Erreur abonnement push:', error);
    }
  }

  // Convertit la clé VAPID
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Notification de test (pour debug)
  window.testNotification = async function() {
    try {
      // Vérifie et demande la permission si nécessaire
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          showConfirmationToast('❌ Permission refusée');
          return;
        }
      }
      
      if (Notification.permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification('Test Baguette Chaussette 🥖', {
          body: 'Ceci est une notification de test !',
          icon: '/favicons/web-app-manifest-192x192.png',
          badge: '/favicons/favicon-96x96.png',
          vibrate: [200, 100, 200],
          tag: 'test-notification',
          requireInteraction: false,
          actions: [
            { action: 'open', title: 'Ouvrir', icon: '/favicons/favicon-96x96.png' },
            { action: 'close', title: 'Fermer' }
          ],
          data: {
            url: 'https://www.twitch.tv/baguettechaussette',
            timestamp: Date.now()
          }
        });
        showConfirmationToast('✅ Notification envoyée !');
      } else if (Notification.permission === 'denied') {
        showConfirmationToast('⚠️ Les notifications sont bloquées. Active-les dans les paramètres du navigateur.');
      }
    } catch (error) {
      console.error('Erreur notification:', error);
      showConfirmationToast('❌ Erreur: ' + error.message);
    }
  };

  // Vérifie périodiquement si un stream est en cours
  function checkStreamStatus() {
    const liveIndicator = document.querySelector('.live-indicator');
    const isLive = liveIndicator?.classList.contains('active');
    const lastNotified = localStorage.getItem('last_live_notification');
    const now = Date.now();

    // Envoie une notification si:
    // - Le stream est live
    // - Les notifications sont activées
    // - Pas de notification envoyée depuis 4h
    if (isLive && 
        Notification.permission === 'granted' && 
        (!lastNotified || now - parseInt(lastNotified) > 4 * 60 * 60 * 1000)) {
      
      sendLiveNotification();
      localStorage.setItem('last_live_notification', now.toString());
    }
  }

  // Envoie une notification de live
  async function sendLiveNotification() {
    try {
      // Vérifie la permission avant d'envoyer
      if (Notification.permission !== 'granted') {
        console.log('Permission non accordée, notification annulée');
        return;
      }
      
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('🔴 Baguette Chaussette est en live !', {
        body: 'Le stream a commencé ! Viens faire un tour 🥖',
        icon: '/favicons/web-app-manifest-192x192.png',
        badge: '/favicons/favicon-96x96.png',
        vibrate: [300, 100, 300, 100, 300],
        tag: 'live-notification',
        requireInteraction: true,
        actions: [
          { action: 'join', title: 'Rejoindre le stream 🎮' },
          { action: 'later', title: 'Plus tard' }
        ],
        data: {
          url: 'https://www.twitch.tv/baguettechaussette',
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('Erreur lors de l\'envoi de la notification:', error);
    }
  }

  // Toast de confirmation
  function showConfirmationToast(message) {
    const toast = document.createElement('div');
    toast.className = 'notification-toast';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Vérifie le statut toutes les 5 minutes
  setInterval(checkStreamStatus, 5 * 60 * 1000);
  
  // Vérifie au chargement aussi
  window.addEventListener('load', () => {
    setTimeout(checkStreamStatus, 5000);
  });

  // Expose les fonctions utiles
  window.BaguetteNotifications = {
    test: window.testNotification,
    checkStatus: checkStreamStatus
  };

  console.log('🔔 Système de notifications initialisé');
})();

// Styles inline pour les notifications
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
  .notification-prompt {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(150px);
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border: 2px solid #9146ff;
    border-radius: 16px;
    padding: 1.5rem;
    box-shadow: 0 8px 32px rgba(145, 70, 255, 0.4);
    z-index: 10000;
    max-width: 420px;
    width: calc(100% - 40px);
    opacity: 0;
    transition: all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    backdrop-filter: blur(10px);
  }

  .notification-prompt.show {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }

  .notification-prompt-content {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1.2rem;
  }

  .notification-prompt-icon {
    font-size: 2.5rem;
    animation: ring 2s ease-in-out infinite;
  }

  @keyframes ring {
    0%, 100% { transform: rotate(0deg); }
    10%, 30% { transform: rotate(-10deg); }
    20%, 40% { transform: rotate(10deg); }
    50% { transform: rotate(0deg); }
  }

  .notification-prompt-text {
    flex: 1;
  }

  .notification-prompt-text strong {
    display: block;
    color: #fff;
    font-size: 1.1rem;
    margin-bottom: 0.4rem;
    font-weight: 700;
  }

  .notification-prompt-text p {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.95rem;
    margin: 0;
    line-height: 1.4;
  }

  .notification-prompt-actions {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }

  .notification-btn {
    padding: 0.9rem 1.5rem;
    border: none;
    border-radius: 10px;
    font-family: 'Baloo 2', sans-serif;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    width: 100%;
  }

  .notification-btn-accept {
    background: linear-gradient(135deg, #9146ff, #ff6b9d);
    color: white;
  }

  .notification-btn-accept:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(145, 70, 255, 0.5);
  }

  .notification-btn-decline {
    background: transparent;
    color: rgba(255, 255, 255, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .notification-btn-decline:hover {
    background: rgba(255, 255, 255, 0.05);
    color: white;
  }

  .notification-toast {
    position: fixed;
    top: 80px;
    right: 20px;
    background: rgba(26, 26, 46, 0.95);
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    font-family: 'Baloo 2', sans-serif;
    font-weight: 600;
    z-index: 10001;
    opacity: 0;
    transform: translateX(120%);
    transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    backdrop-filter: blur(10px);
  }

  .notification-toast.show {
    opacity: 1;
    transform: translateX(0);
  }

  @media (max-width: 768px) {
    .notification-prompt {
      bottom: 10px;
      width: calc(100% - 20px);
    }

    .notification-toast {
      right: 10px;
      left: 10px;
      transform: translateX(0) translateY(-120%);
    }

    .notification-toast.show {
      transform: translateX(0) translateY(0);
    }
  }
`;
document.head.appendChild(notificationStyles);
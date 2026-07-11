// Badge "EN LIVE" dans la navbar — commun à toutes les pages avec #navbar.
// Poll léger de data/live-status.json (mis à jour toutes les 5 min par GitHub Actions),
// indépendant du countdown de l'accueil.
(function initNavLiveBadge() {
    const container = document.querySelector('#navbar .container');
    const logo = container?.querySelector('.logo');
    if (!logo) return;

    const badge = document.createElement('a');
    badge.id = 'navLiveBadge';
    badge.className = 'nav-live-badge';
    badge.href = 'https://www.twitch.tv/baguettechaussette';
    badge.target = '_blank';
    badge.rel = 'noopener';
    badge.hidden = true;
    badge.setAttribute('data-umami-event', 'Nav - Live Badge');
    badge.innerHTML = '<span class="nav-live-dot" aria-hidden="true"></span>EN LIVE';
    logo.insertAdjacentElement('afterend', badge);

    async function check() {
        try {
            const r = await fetch('/data/live-status.json', { cache: 'no-store' });
            if (!r.ok) return;
            const json = await r.json();
            const live = !!(json && json.is_live);
            badge.hidden = !live;
            badge.title = live && json.game ? `En live sur ${json.game} — rejoindre le stream` : 'Rejoindre le stream';
        } catch { /* silencieux : le badge reste simplement caché */ }
    }

    check();
    setInterval(() => { if (!document.hidden) check(); }, 30_000);
})();

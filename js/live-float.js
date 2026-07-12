// Pastille flottante "EN LIVE" accrochée au bord droit de l'écran.
// Poll léger de data/live-status.json (mis à jour toutes les 5 min par GitHub Actions),
// indépendant du countdown de l'accueil. N'apparaît que pendant un live.
(function initLiveFloat() {
    const pill = document.createElement('a');
    pill.id = 'liveFloat';
    pill.className = 'live-float';
    pill.href = 'https://www.twitch.tv/baguettechaussette';
    pill.target = '_blank';
    pill.rel = 'noopener';
    pill.hidden = true;
    pill.setAttribute('data-umami-event', 'Live Float - Click');
    pill.innerHTML = '<span class="live-float-dot" aria-hidden="true"></span>EN LIVE';
    document.body.appendChild(pill);

    async function check() {
        try {
            const r = await fetch('/data/live-status.json', { cache: 'no-store' });
            if (!r.ok) return;
            const json = await r.json();
            const live = !!(json && json.is_live);
            pill.hidden = !live;
            pill.title = live && json.game ? `En live sur ${json.game}, rejoins le stream !` : 'Rejoindre le stream';
        } catch { /* silencieux : la pastille reste simplement cachée */ }
    }

    check();
    setInterval(() => { if (!document.hidden) check(); }, 30_000);
})();

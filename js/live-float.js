// Pastille flottante "EN LIVE" accrochée au bord droit de l'écran.
// Statut demandé au worker Cloudflare, qui interroge Twitch en direct (le cron
// GitHub est bridé à plusieurs heures de retard). Indépendant du countdown de
// l'accueil. N'apparaît que pendant un live.
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

    const LIVE_API = 'https://bc-vote.baguette-chaussette.workers.dev/live';
    let fails = 0; // 3 échecs d'affilée (~90 s) avant de masquer : tolère un blip réseau

    async function check() {
        try {
            const r = await fetch(LIVE_API, { cache: 'no-store' });
            if (!r.ok) throw new Error(String(r.status));
            const json = await r.json();
            fails = 0;
            const live = !!(json && json.is_live);
            pill.hidden = !live;
            pill.title = live && json.game ? `En live sur ${json.game}, rejoins le stream !` : 'Rejoindre le stream';
        } catch {
            // Statut inconnu : on masque plutôt que de laisser un badge périmé.
            if (++fails >= 3) pill.hidden = true;
        }
    }

    check();
    setInterval(() => { if (!document.hidden) check(); }, 30_000);
})();

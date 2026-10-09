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
    let fails = 0;

    function forcedLiveForTests() {
        if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return null;
        const p = new URLSearchParams(location.search).get('live');
        if (p === '' || p === 'off') sessionStorage.removeItem('bc_force_live');
        else if (p !== null) sessionStorage.setItem('bc_force_live', p);
        const v = sessionStorage.getItem('bc_force_live');
        if (v === null) return null;
        return v === '1'
            ? { is_live: true, game: 'Jeu de test', title: 'Live de test', started_at: new Date(Date.now() - 42 * 60000).toISOString() }
            : { is_live: false, game: null, title: null, started_at: null };
    }

    async function check() {
        try {
            let json = forcedLiveForTests();
            if (!json) {
                const r = await fetch(LIVE_API, { cache: 'no-store' });
                if (!r.ok) throw new Error(String(r.status));
                json = await r.json();
            }
            fails = 0;
            const live = !!(json && json.is_live);
            pill.hidden = !live;
            pill.title = live && json.game ? `En live sur ${json.game}, rejoins le stream !` : 'Rejoindre le stream';
        } catch {
            if (++fails >= 3) pill.hidden = true;
        }
    }

    check();
    setInterval(() => { if (!document.hidden) check(); }, 30_000);
})();

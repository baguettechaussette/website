// Page /clips : Le Clip de la Semaine (vote) + Le Panthéon des clippeurs.
// Chargé après main.js (réutilise openClipModal et clipDisplayTitle).
document.addEventListener('DOMContentLoaded', () => {
    loadClipOfWeek();
    loadClippers();
    loadHallOfFame();
    injectVideoSchema();
});

// Données structurées VideoObject pour les clips (onglet Vidéos de Google).
// Injecté côté client depuis data/top-clips.json : Google rend le JS pour le
// balisage, avec un délai — acceptable pour ce contenu communautaire.
async function injectVideoSchema() {
    try {
        const r = await fetch('/data/top-clips.json');
        if (!r.ok) return;
        const data = await r.json();
        const all = [...(data.pinned || []), ...(data.clips || [])];

        const videos = all.filter(c => c && c.id && c.thumbnail_url).slice(0, 20).map(c => {
            const name = c.title || 'Clip de Baguette Chaussette';
            const vo = {
                '@type': 'VideoObject',
                name,
                description: c.creator_name ? `${name} — clip Twitch de Baguette Chaussette, clippé par ${c.creator_name}.` : `${name} — clip Twitch de Baguette Chaussette.`,
                thumbnailUrl: c.thumbnail_url,
                contentUrl: c.url || `https://clips.twitch.tv/${c.id}`,
                embedUrl: `https://clips.twitch.tv/embed?clip=${c.id}`,
                creator: { '@type': 'Person', '@id': 'https://baguettechaussette.fr/#person' }
            };
            if (c.created_at) vo.uploadDate = c.created_at;
            return vo;
        });
        if (!videos.length) return;

        const ld = {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Clips de Baguette Chaussette',
            itemListElement: videos.map((v, i) => ({ '@type': 'ListItem', position: i + 1, item: v }))
        };

        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(ld);
        document.head.appendChild(script);
    } catch { /* silencieux : le balisage est un bonus, pas un bloquant */ }
}

// Compteur de votes (Cloudflare Worker, voir cloudflare/README.md).
// L'URL doit aussi figurer dans le connect-src de la CSP de clips.html,
// et dans la variable de dépôt GitHub VOTE_API_URL (dépouillement auto).
const VOTE_API = 'https://bc-vote.baguette-chaussette.workers.dev';

// ── Petits helpers DOM ──────────────────────────────────────
function makeEl(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
}

// localStorage peut être interdit (navigation privée stricte) : dans ce cas
// on vote quand même, c'est le worker qui déduplique par IP.
function lsGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key, value) {
    try { localStorage.setItem(key, value); } catch { /* privé strict : tant pis */ }
}

// Miniature cliquable qui ouvre la modale de lecture (même pattern que loadTopClips)
function makeClipThumb(clip, umamiEvent) {
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'clip-thumb';
    thumb.setAttribute('data-umami-event', umamiEvent);
    thumb.setAttribute('aria-label', `Regarder le clip : ${clipDisplayTitle(clip)}`);
    if (clip.thumbnail_url) {
        const img = document.createElement('img');
        img.src = clip.thumbnail_url;
        img.alt = '';
        img.loading = 'lazy';
        // Vignette morte = clip supprimé de Twitch entre deux purges du
        // workflow : on masque la carte (ses votes sont ignorés au dépouillement).
        img.addEventListener('error', () => {
            const dead = thumb.closest('.cow-card, .cow-winner');
            if (dead) dead.hidden = true;
        });
        thumb.appendChild(img);
    }
    const play = makeEl('span', 'clip-play', '▶');
    play.setAttribute('aria-hidden', 'true');
    thumb.appendChild(play);
    thumb.addEventListener('click', () => openClipModal(clip));
    return thumb;
}

// ── Le Clip de la Semaine ───────────────────────────────────
// "2026-W28" → lundi de cette semaine ISO (UTC)
function isoWeekMonday(week) {
    const m = /^(\d{4})-W(\d{2})$/.exec(week || '');
    if (!m) return null;
    const jan4 = new Date(Date.UTC(+m[1], 0, 4));
    const monday = new Date(jan4);
    monday.setUTCDate(jan4.getUTCDate() - (jan4.getUTCDay() || 7) + 1 + (+m[2] - 1) * 7);
    return monday;
}

// Les finalistes viennent de la semaine ISO qui précède la semaine de vote
function finalistWeekRange(week) {
    const voteMonday = isoWeekMonday(week);
    if (!voteMonday) return null;
    const start = new Date(voteMonday); start.setUTCDate(start.getUTCDate() - 7);
    const end = new Date(voteMonday); end.setUTCDate(end.getUTCDate() - 1);
    const fmt = d => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
    return `${fmt(start)} au ${fmt(end)}`;
}

async function loadClipOfWeek() {
    const section = document.getElementById('clip-semaine');
    const voteBlock = document.getElementById('cowVoteBlock');
    const voteHeading = document.getElementById('cowVoteHeading');
    const winnerBox = document.getElementById('cowWinner');
    const grid = document.getElementById('cowGrid');
    if (!section || !voteBlock || !winnerBox || !grid) return;

    try {
        // no-store : après la rotation du dimanche, pas de finalistes périmés
        // servis par le cache HTTP (même politique que followers.json)
        const r = await fetch('/data/clip-of-week.json', { cache: 'no-store' });
        if (!r.ok) return;
        const data = await r.json();
        const finalists = (Array.isArray(data.finalists) ? data.finalists : []).filter(c => c && c.id);
        const week = data.week;

        // Le vote d'abord : c'est l'action principale de la section
        if (week && finalists.length >= 2) {
            const range = finalistWeekRange(week);
            if (range && voteHeading) voteHeading.textContent = `🗳️ Les finalistes du ${range}`;
            const votedKey = `clip-vote-${week}`;
            finalists.forEach(clip => {
                grid.appendChild(buildFinalistCard(clip, week, votedKey));
            });
            // Confirmation de vote annoncée aux lecteurs d'écran
            const status = makeEl('p', 'visually-hidden');
            status.id = 'cowVoteStatus';
            status.setAttribute('aria-live', 'polite');
            voteBlock.appendChild(status);
            refreshVoteButtons(grid, lsGet(votedKey));
            voteBlock.hidden = false;
            showTurnout(week, voteHeading);
        }

        // Puis le palmarès : le clip élu la semaine dernière
        if (data.winner && data.winner.id) {
            winnerBox.appendChild(makeEl('h3', 'cow-block-heading', '👑 Le clip gagnant de la semaine dernière'));
            const card = makeEl('div', 'cow-winner-card');
            card.appendChild(makeClipThumb(data.winner, 'Clips - Play Winner'));
            const info = makeEl('div', 'cow-winner-info');
            info.appendChild(makeEl('p', 'cow-winner-title', `« ${clipDisplayTitle(data.winner)} »`));
            if (data.winner.creator_name) {
                info.appendChild(makeEl('p', 'clip-clipper', `clippé par ${data.winner.creator_name}`));
            }
            info.appendChild(makeEl('p', 'cow-winner-sub', 'Élu par les p\'tits pains au live du dimanche'));
            card.appendChild(info);
            winnerBox.appendChild(card);
            winnerBox.hidden = false;
        }

        if (!winnerBox.hidden || !voteBlock.hidden) section.hidden = false;
    } catch { /* silencieux : la section reste cachée */ }
}

function buildFinalistCard(clip, week, votedKey) {
    const card = makeEl('div', 'cow-card');
    card.appendChild(makeClipThumb(clip, 'Clips - Play Finalist'));
    card.appendChild(makeEl('p', 'clip-meta', `« ${clipDisplayTitle(clip)} »`));
    if (clip.creator_name) {
        card.appendChild(makeEl('p', 'clip-clipper', `clippé par ${clip.creator_name}`));
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cow-vote-btn';
    btn.dataset.clip = clip.id;              // le vote est lié à l'identité du clip
    btn.textContent = 'Voter pour ce clip 🥖';
    btn.addEventListener('click', () => {
        if (lsGet(votedKey)) return;
        // Compteur principal : le Worker Cloudflare (1 vote par IP et par semaine)
        if (VOTE_API) {
            fetch(`${VOTE_API}/vote/${week}/${encodeURIComponent(clip.id)}`, { method: 'POST' })
                .catch(() => { /* silencieux */ });
        }
        // Umami en parallèle : pour tes stats
        try { window.umami?.track(`vote-${week}`, { clip: clip.id }); } catch { /* adblock : tant pis */ }
        lsSet(votedKey, clip.id);
        refreshVoteButtons(card.parentElement, clip.id);
        const status = document.getElementById('cowVoteStatus');
        if (status) status.textContent = 'Vote enregistré, merci !';
    });
    card.appendChild(btn);
    return card;
}

// Participation affichée sous le titre du vote : uniquement le TOTAL de
// votants (le worker ne révèle jamais qui mène : le suspense reste entier).
async function showTurnout(week, after) {
    if (!VOTE_API || !after) return;
    try {
        const r = await fetch(`${VOTE_API}/turnout/${encodeURIComponent(week)}`);
        if (!r.ok) return;
        const { count } = await r.json();
        const n = Number(count) || 0;
        const text = n > 0
            ? `${n} p'tit${n > 1 ? 's' : ''} pain${n > 1 ? 's ont' : ' a'} déjà voté 🥖`
            : 'Sois le premier à voter 🥖';
        after.insertAdjacentElement('afterend', makeEl('p', 'cow-turnout', text));
    } catch { /* silencieux : simple bonus d'ambiance */ }
}

function refreshVoteButtons(grid, votedClip) {
    if (!votedClip || !grid) return;
    grid.querySelectorAll('.cow-vote-btn').forEach(btn => {
        btn.disabled = true;
        if (btn.dataset.clip === votedClip) {
            btn.classList.add('is-voted');
            btn.textContent = 'Voté, merci ! ✔';
        }
    });
}

// ── Le Panthéon des clippeurs ───────────────────────────────
// Rang combiné : le pain + le métal selon le nombre de clips…
// Seuils larges et espacés : les hauts paliers se méritent sur la durée
// (clips et vues sont cumulés all-time), pas débloqués dès le début.
const CLIPPER_BADGES = [
    { min: 100, emoji: '👨‍🍳', label: 'Maître boulanger' },
    { min: 60,  emoji: '🍞', label: 'Miche d\'or' },
    { min: 30,  emoji: '🥐', label: 'Croissant doré' },
    { min: 15,  emoji: '🥖', label: 'Baguette d\'argent' },
    { min: 5,   emoji: '🥨', label: 'Bretzel de bronze' },
    { min: 0,   emoji: '🌾', label: 'P\'tit épi' },
];
// … et un suffixe selon les vues totales (somme des vues de tous ses clips :
// ça grimpe vite, donc le haut est très espacé pour rester un vrai Graal).
const CLIPPER_SUFFIXES = [
    { min: 2000, label: 'légende du fournil' },
    { min: 500,  label: 'qui cartonne' },
    { min: 100,  label: 'graine de star' },
    { min: 0,    label: 'débutant' },
];

async function loadClippers() {
    const section = document.getElementById('clippeurs');
    const grid = document.getElementById('clippersGrid');
    if (!section || !grid) return;

    try {
        const r = await fetch('/data/clippers.json');
        if (!r.ok) return;
        const data = await r.json();
        const clippers = (Array.isArray(data.clippers) ? data.clippers : []).slice(0, 12);
        if (!clippers.length) return;

        const medals = ['🥇', '🥈', '🥉'];
        clippers.forEach((c, i) => {
            const views = c.total_views || 0;
            // (c.clips || 0) : un champ manquant ne doit pas faire échouer le
            // find (undefined >= 0 est faux) et masquer tout le Panthéon.
            const badge = CLIPPER_BADGES.find(b => (c.clips || 0) >= b.min);
            if (!badge) return;
            const suffix = CLIPPER_SUFFIXES.find(s => views >= s.min);
            const card = makeEl('div', 'clipper-card' + (i < 3 ? ` clipper-rank-${i + 1}` : ''));
            card.append(
                makeEl('div', 'clipper-rank', medals[i] || `#${i + 1}`),
                makeEl('div', 'clipper-badge', badge.emoji),
                makeEl('p', 'clipper-name', c.name),
                makeEl('p', 'clipper-grade', badge.label)
            );
            if (suffix) card.appendChild(makeEl('p', 'clipper-suffix', suffix.label));
            card.appendChild(makeEl('p', 'clipper-stats',
                `${c.clips} clip${c.clips > 1 ? 's' : ''} · ${views.toLocaleString('fr-FR')} vues`));
            grid.appendChild(card);
        });

        section.hidden = false;
    } catch { /* silencieux : la section reste cachée */ }
}

// ── Le Palmarès : tous les Clips de la Semaine élus ─────────
async function loadHallOfFame() {
    const section = document.getElementById('palmares');
    const grid = document.getElementById('hofGrid');
    if (!section || !grid) return;

    try {
        const r = await fetch('/data/hall-of-fame.json');
        if (!r.ok) return;
        const data = await r.json();
        const winners = (Array.isArray(data.winners) ? data.winners : [])
            .filter(w => w && w.id)
            .sort((a, b) => String(b.week).localeCompare(String(a.week)))
            .slice(0, 12);
        if (!winners.length) return;

        winners.forEach(w => {
            const card = makeEl('div', 'hof-card');
            card.appendChild(makeClipThumb(w, 'Clips - Play HallOfFame'));
            card.appendChild(makeEl('p', 'clip-meta', `« ${clipDisplayTitle(w)} »`));
            if (w.creator_name) {
                card.appendChild(makeEl('p', 'clip-clipper', `clippé par ${w.creator_name}`));
            }
            const when = w.crowned_at
                ? new Date(w.crowned_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
                : null;
            const voix = (Number(w.votes) > 0)
                ? `${w.votes} voix`
                : null;
            card.appendChild(makeEl('p', 'hof-meta',
                `👑 ${[when ? `élu le ${when}` : null, voix].filter(Boolean).join(' · ')}`));
            grid.appendChild(card);
        });

        section.hidden = false;
    } catch { /* silencieux : la section reste cachée */ }
}

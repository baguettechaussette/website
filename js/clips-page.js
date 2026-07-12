// Page /clips : Le Clip de la Semaine (vote) + Le Panthéon des clippeurs.
// Chargé après main.js (réutilise openClipModal et clipDisplayTitle).
document.addEventListener('DOMContentLoaded', () => {
    loadClipOfWeek();
    loadClippers();
});

// Compteur de votes (Cloudflare Worker, voir cloudflare/README.md).
// Tant que l'URL est vide, le vote repose sur Umami seul + dépouillement manuel.
// Après déploiement : renseigner l'URL ici ET l'ajouter au connect-src de la CSP
// de clips.html, ET créer la variable de dépôt GitHub VOTE_API_URL.
const VOTE_API = '';

// ── Petits helpers DOM ──────────────────────────────────────
function makeEl(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
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
        thumb.appendChild(img);
    }
    const play = makeEl('span', 'clip-play', '▶');
    play.setAttribute('aria-hidden', 'true');
    thumb.appendChild(play);
    thumb.addEventListener('click', () => openClipModal(clip));
    return thumb;
}

// ── Le Clip de la Semaine ───────────────────────────────────
async function loadClipOfWeek() {
    const section = document.getElementById('clip-semaine');
    const winnerBox = document.getElementById('cowWinner');
    const grid = document.getElementById('cowGrid');
    if (!section || !winnerBox || !grid) return;

    try {
        const r = await fetch('/data/clip-of-week.json');
        if (!r.ok) return;
        const data = await r.json();
        const finalists = Array.isArray(data.finalists) ? data.finalists : [];
        const week = data.week;

        // Gagnant de la semaine passée
        if (data.winner && data.winner.id) {
            winnerBox.appendChild(makeClipThumb(data.winner, 'Clips - Play Winner'));
            const info = makeEl('div', 'cow-winner-info');
            info.append(
                makeEl('p', 'cow-winner-label', '👑 Élu par les p\'tits pains la semaine passée :'),
                makeEl('p', 'clip-meta', `« ${clipDisplayTitle(data.winner)} »`)
            );
            if (data.winner.creator_name) {
                info.appendChild(makeEl('p', 'clip-clipper', `clippé par ${data.winner.creator_name}`));
            }
            winnerBox.appendChild(info);
            winnerBox.hidden = false;
        }

        // Finalistes de la semaine en cours
        if (week && finalists.length >= 2) {
            const votedKey = `clip-vote-${week}`;
            finalists.forEach((clip, i) => {
                grid.appendChild(buildFinalistCard(clip, i + 1, week, votedKey));
            });
            refreshVoteButtons(grid, localStorage.getItem(votedKey));
        }

        if (!winnerBox.hidden || grid.children.length) section.hidden = false;
    } catch { /* silencieux : la section reste cachée */ }
}

function buildFinalistCard(clip, n, week, votedKey) {
    const card = makeEl('div', 'cow-card');
    card.appendChild(makeClipThumb(clip, 'Clips - Play Finalist'));
    card.appendChild(makeEl('p', 'clip-meta', `« ${clipDisplayTitle(clip)} »`));
    if (clip.creator_name) {
        card.appendChild(makeEl('p', 'clip-clipper', `clippé par ${clip.creator_name}`));
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cow-vote-btn';
    btn.dataset.n = String(n);
    btn.textContent = 'Voter pour ce clip 🥖';
    btn.addEventListener('click', () => {
        if (localStorage.getItem(votedKey)) return;
        // Compteur principal : le Worker Cloudflare (1 vote par IP et par semaine)
        if (VOTE_API) {
            fetch(`${VOTE_API}/vote/${week}/${n}`, { method: 'POST' }).catch(() => { /* silencieux */ });
        }
        // Umami en parallèle : stats + filet de secours du dépouillement manuel
        try { window.umami?.track(`vote-${week}-${n}`); } catch { /* adblock : tant pis */ }
        localStorage.setItem(votedKey, String(n));
        refreshVoteButtons(card.parentElement, String(n));
    });
    card.appendChild(btn);
    return card;
}

function refreshVoteButtons(grid, votedN) {
    if (!votedN || !grid) return;
    grid.querySelectorAll('.cow-vote-btn').forEach(btn => {
        btn.disabled = true;
        if (btn.dataset.n === votedN) {
            btn.classList.add('is-voted');
            btn.textContent = 'Voté, merci ! ✔';
        }
    });
}

// ── Le Panthéon des clippeurs ───────────────────────────────
const CLIPPER_BADGES = [
    { min: 30, emoji: '🍞', label: 'Miche d\'or' },
    { min: 15, emoji: '🥖', label: 'Baguette d\'argent' },
    { min: 5,  emoji: '🥐', label: 'Croissant doré' },
    { min: 0,  emoji: '🌾', label: 'P\'tit épi' },
];

async function loadClippers() {
    const section = document.getElementById('clippeurs');
    const grid = document.getElementById('clippersGrid');
    if (!section || !grid) return;

    try {
        const r = await fetch('/data/clippers.json');
        if (!r.ok) return;
        const data = await r.json();
        const clippers = (Array.isArray(data.clippers) ? data.clippers : []).slice(0, 6);
        if (!clippers.length) return;

        const medals = ['🥇', '🥈', '🥉'];
        clippers.forEach((c, i) => {
            const badge = CLIPPER_BADGES.find(b => c.clips >= b.min);
            const card = makeEl('div', 'clipper-card' + (i < 3 ? ` clipper-rank-${i + 1}` : ''));
            card.append(
                makeEl('div', 'clipper-rank', medals[i] || `#${i + 1}`),
                makeEl('div', 'clipper-badge', badge.emoji),
                makeEl('p', 'clipper-name', c.name),
                makeEl('p', 'clipper-grade', badge.label),
                makeEl('p', 'clipper-stats',
                    `${c.clips} clip${c.clips > 1 ? 's' : ''} · ${(c.total_views || 0).toLocaleString('fr-FR')} vues`)
            );
            grid.appendChild(card);
        });

        section.hidden = false;
    } catch { /* silencieux : la section reste cachée */ }
}

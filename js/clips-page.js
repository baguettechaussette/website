// Page /clips : Le Clip de la Semaine (vote), le Palmarès et le Panthéon des clippeurs.
// Chargé après main.js (réutilise openClipModal et clipDisplayTitle).
document.addEventListener('DOMContentLoaded', () => {
    placerCommentClipper();
    loadClipOfWeek();
    loadPalmares();
    loadClippers();
    injectVideoSchema();
});

// « Et si la prochaine couronne était pour toi ? » n'existe qu'une fois
// dans le HTML mais ne se range pas au même endroit : à côté du clip gagnant
// en desktop, à la fin du Panthéon en mobile. On le déplace
// plutôt que de le dupliquer, et on suit les changements de largeur.
// Semaine sans vote ni gagnant (#clip-semaine.is-empty) : en mobile aussi il
// remonte à la place du vote, juste sous le hero, au lieu d'attendre sous
// les douze cartes du Panthéon.
function placerCommentClipper() {
    const bloc = document.querySelector('.clip-howto');
    const pantheon = document.getElementById('clippeurs');
    const semaine = document.querySelector('.cow-container');
    if (!bloc || !pantheon || !semaine) return;

    const section = document.getElementById('clip-semaine');
    const desktop = window.matchMedia('(min-width: 769px)');
    const placer = () => {
        const vide = section && section.classList.contains('is-empty');
        const cible = desktop.matches || vide ? semaine : pantheon;
        if (bloc.parentElement !== cible) cible.appendChild(bloc);
    };
    placer();
    desktop.addEventListener('change', placer);
    // loadClipOfWeek prévient une fois l'état de la semaine connu
    if (section) section.addEventListener('cow-etat', placer);
}

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

// Sous 769 px : carrousel des finalistes,
// bloc gagnant sombre, écran « A voté » après le vote. Les éléments construits
// pour ce mode sont masqués au-dessus de 768 px par le CSS.
const MOBILE_MQ = window.matchMedia('(max-width: 768px)');
const DISCORD_URL = 'https://discord.gg/QHNF684bBf';

// ── Petits helpers DOM ──────────────────────────────────────
// Coche blanche des boutons de vote, en SVG (pas d'emoji dans les boutons)
const CHECK_SVG = '<svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
const checkTpl = document.createElement('template');
checkTpl.innerHTML = CHECK_SVG;
function setBtnLabel(btn, text, withCheck) {
    btn.textContent = text;
    if (withCheck) btn.appendChild(checkTpl.content.firstElementChild.cloneNode(true));
}

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
function lsRemove(key) {
    try { localStorage.removeItem(key); } catch { /* privé strict : tant pis */ }
}

// ── Interrupteurs de test, sur localhost uniquement ─────────
// ?cow=<état> rejoue les états du Clip de la Semaine sans toucher aux données :
//   vote   → vote ouvert, personne n'a voté (efface le vote enregistré)
//   voted  → comme si on avait voté pour le premier finaliste
//   winner → le gagnant est révélé (sa carte)
//   teaser → le gagnant attend la révélation en live (📦)
//   empty  → ni finalistes ni gagnant : la section se replie
//   ?cow=  → rend la main aux vraies données
// ?turnout=<n> force le nombre de votants (le worker n'est plus consulté).
// Le choix est gardé pour la session, d'une page à l'autre. Hors localhost
// et 127.0.0.1, ces fonctions renvoient null et rien ne change.
function testFlag(name) {
    if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return null;
    const key = `bc_test_${name}`;
    const p = new URLSearchParams(location.search).get(name);
    if (p === '') { try { sessionStorage.removeItem(key); } catch {} return null; }
    try {
        if (p !== null) sessionStorage.setItem(key, p);
        return sessionStorage.getItem(key);
    } catch { return p; }
}

// Miniature cliquable qui ouvre la modale de lecture (même pattern que loadTopClips)
// sizes : largeur CSS de la vignette (finalistes : carrousel en mobile, 340 px en
// tablette, ~260 px dans la grille desktop)
function makeClipThumb(clip, umamiEvent, sizes = '(max-width: 599px) calc(100vw - 46px), (max-width: 768px) 340px, 260px') {
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'clip-thumb';
    thumb.setAttribute('data-umami-event', umamiEvent);
    thumb.setAttribute('aria-label', `Regarder le clip : ${clipDisplayTitle(clip)}`);
    if (clip.thumbnail_url) {
        const img = document.createElement('img');
        img.alt = '';
        img.loading = 'lazy';
        setClipThumbSources(img, clip.thumbnail_url, sizes);
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

// Les finalistes viennent de la fenêtre de 14 jours (deux dimanches avant la
// semaine de vote → le dimanche qui la précède), calée sur le dépouillement :
// voir update-clip-vote.yml. Le -15 reflète STARTED_AT côté workflow.
function finalistWeekRange(week) {
    const voteMonday = isoWeekMonday(week);
    if (!voteMonday) return null;
    const start = new Date(voteMonday); start.setUTCDate(start.getUTCDate() - 15);
    const end = new Date(voteMonday); end.setUTCDate(end.getUTCDate() - 1);
    const fmt = d => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
    // Meme mois : on ne le repete pas (« du 7 au 21 septembre »)
    if (start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()) {
        return `${start.getUTCDate()} au ${fmt(end)}`;
    }
    return `${fmt(start)} au ${fmt(end)}`;
}

async function loadClipOfWeek() {
    const section = document.getElementById('clip-semaine');
    const voteBlock = document.getElementById('cowVoteBlock');
    const voteHeading = document.getElementById('cowVoteHeading');
    const winnerBox = document.getElementById('cowWinner');
    const grid = document.getElementById('cowGrid');
    if (!section || !voteBlock || !winnerBox || !grid) return;

    // La section est visible dès le premier rendu (titre + squelette) pour ne pas
    // faire sauter la page : ici on remplace le squelette, on ne révèle plus.
    const skeleton = document.getElementById('cowSkeleton');
    // Squelette du gagnant : il reste jusqu'à la réponse du worker (révélé ou
    // non), qui arrive après le JSON.
    const winnerSkel = winnerBox.querySelector('.cow-winner-skel');
    const collapse = () => { skeleton?.remove(); winnerSkel?.remove(); section.hidden = true; };

    try {
        // no-store : après la rotation du dimanche, pas de finalistes périmés
        // servis par le cache HTTP (même politique que followers.json)
        const r = await fetch('/data/clip-of-week.json', { cache: 'no-store' });
        if (!r.ok) { collapse(); return; }
        const data = await r.json();
        let finalists = (Array.isArray(data.finalists) ? data.finalists : []).filter(c => c && c.id);
        const week = data.week;
        skeleton?.remove();

        const cowTest = testFlag('cow');
        if (cowTest === 'empty') { finalists = []; data.winner = null; }
        // winner / teaser sans gagnant dans le JSON : on en emprunte un pour la démo
        if ((cowTest === 'winner' || cowTest === 'teaser') && !(data.winner && data.winner.id) && finalists[0]) {
            data.winner = finalists[0];
        }

        // Le vote d'abord : c'est l'action principale de la section
        if (week && finalists.length >= 2) {
            const range = finalistWeekRange(week);
            if (range && voteHeading) voteHeading.textContent = `🗳️ Les finalistes du ${range}`;
            // Ligne de l'entete, version desktop : le compte, la fenetre de
            // selection et le rendez-vous, en une phrase.
            const heroLine = document.getElementById('clipsHeroLine');
            if (heroLine && range) {
                heroLine.textContent =
                    `${finalists.length} finalistes clippés du ${range}. `
                    + 'Le résultat tombe dimanche à 21h en live, puis sur Discord.';
            }
            const votedKey = `clip-vote-${week}`;
            if (cowTest === 'vote') lsRemove(votedKey);
            else if (cowTest === 'voted' && finalists[0]) lsSet(votedKey, finalists[0].id);
            finalists.forEach((clip, i) => {
                grid.appendChild(buildFinalistCard(clip, week, votedKey, i + 1, finalists.length));
            });
            buildDots(voteBlock, grid, finalists.length);
            // Confirmation de vote annoncée aux lecteurs d'écran
            const status = makeEl('p', 'visually-hidden');
            status.id = 'cowVoteStatus';
            status.setAttribute('aria-live', 'polite');
            voteBlock.appendChild(status);
            refreshVoteButtons(grid, lsGet(votedKey));
            voteBlock.hidden = false;
            showTurnout(week, voteHeading);
        }

        // Puis le palmarès : le clip élu la semaine dernière — mais seulement
        // une fois la révélation faite (clic sur le board pendant le live du
        // dimanche, ou filet du lundi). Avant : un teaser, pour que personne
        // ne voie le gagnant sur le site avant la cérémonie de 21h.
        if (data.winner && data.winner.id) {
            const revealed = await isWinnerRevealed(week);
            winnerSkel?.remove();
            winnerBox.appendChild(buildWinnerHead(week, revealed));
            if (revealed) {
                winnerBox.appendChild(makeEl('h3', 'cow-block-heading', '👑 Le clip gagnant de la semaine dernière'));
                const card = makeEl('div', 'cow-winner-card');
                // Le gagnant est la plus grande vignette de la page
                card.appendChild(makeClipThumb(data.winner, 'Clips - Play Winner', '(max-width: 599px) calc(100vw - 60px), (max-width: 768px) 480px, 506px'));
                const info = makeEl('div', 'cow-winner-info');
                info.appendChild(makeEl('p', 'cow-winner-title', `« ${clipDisplayTitle(data.winner)} »`));
                if (data.winner.creator_name) {
                    // Le nom dans un <strong> : il porte sa propre couleur
                    const par = makeEl('p', 'clip-clipper');
                    par.append('clippé par ', makeEl('strong', '', data.winner.creator_name));
                    info.appendChild(par);
                }
                card.appendChild(info);
                winnerBox.appendChild(card);
            } else {
                winnerBox.appendChild(makeEl('h3', 'cow-block-heading', '👑 Le gagnant est dans la boîte…'));
                const teaser = makeEl('div', 'cow-winner-teaser');
                teaser.append(makeEl('span', 'cow-winner-teaser-icon', '📦'), makeEl('span', 'cow-winner-teaser-text', 'Le gagnant est dans la boîte…'));
                winnerBox.appendChild(teaser);
                winnerBox.appendChild(makeEl('p', 'cow-winner-sub',
                    'Les votes sont dépouillés ! Révélation en live dimanche à 21h..'));
            }
            winnerBox.hidden = false;
        } else {
            winnerSkel?.remove();
            winnerBox.hidden = true;
        }

        // Ni vote ni gagnant : la section ne garde que « À toi de jouer »
        // (en bannière pleine largeur en desktop, via .is-empty)
        const vide = voteBlock.hidden && winnerBox.hidden;
        section.classList.toggle('is-empty', vide);
        section.dispatchEvent(new Event('cow-etat'));

        // Sans vote en cours, le hero ne pose plus la question et n'annonce
        // plus de résultat dimanche
        if (voteBlock.hidden) {
            const t = document.getElementById('clipsHeroTitle');
            const m = document.getElementById('clipsHeroMeta');
            const k = document.querySelector('.page-hero-kicker');
            if (t) t.textContent = 'Les clips des p\'tits pains';
            if (k) k.textContent = vide ? 'Clips' : 'Clips · clip de la semaine';
            if (m && vide) {
                const court = m.querySelector('.meta-mobile');
                const long = document.getElementById('clipsHeroLine');
                if (court) court.textContent = 'Pas de vote cette semaine !';
                if (long) long.textContent = 'Pas de vote cette semaine !';
            } else if (m) {
                m.hidden = true;
            }
        }

        // Ni vote ni gagnant : la section reste, réduite à « À toi de jouer »
        // (.is-empty), seul appel à l'action de la page cette semaine-là.
    } catch { collapse(); /* silencieux : sans données, pas de section */ }
}

// En-tête du bloc gagnant (mobile) : 👑, « Clip de la semaine », date du dimanche du couronnement
function buildWinnerHead(week, revealed) {
    const head = makeEl('div', 'cow-winner-head');
    const meta = makeEl('div', 'cow-winner-head-meta');
    let when = 'dépouillement terminé';
    if (revealed) {
        const monday = isoWeekMonday(week);
        if (monday) {
            const sunday = new Date(monday); sunday.setUTCDate(sunday.getUTCDate() - 1);
            when = `élu par la commu · ${sunday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })}`;
        } else {
            when = 'élu par la commu';
        }
    }
    meta.append(makeEl('span', 'cow-winner-kicker', 'Clip de la semaine'), makeEl('span', 'cow-winner-when', when));
    head.append(makeEl('span', 'cow-winner-crown', '👑'), meta);
    return head;
}

// Points de position sous le carrousel (mobile) + « Glisse pour voir les 7 autres → »
function buildDots(voteBlock, grid, count) {
    if (count < 2) return;
    const wrap = makeEl('div', 'cow-dots');
    const track = makeEl('div', 'cow-dots-track');
    for (let i = 0; i < count; i++) track.appendChild(makeEl('span', 'cow-dot' + (i === 0 ? ' is-active' : '')));
    const hint = makeEl('span', 'cow-dots-hint', `Glisse pour voir ${count - 1 > 1 ? `les ${count - 1} autres` : 'le suivant'} →`);
    wrap.append(track, hint);
    voteBlock.appendChild(wrap);

    let raf = 0;
    grid.addEventListener('scroll', () => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
            raf = 0;
            const cards = grid.querySelectorAll('.cow-card');
            if (!cards.length) return;
            const step = cards[0].offsetWidth + (parseFloat(getComputedStyle(grid).columnGap || getComputedStyle(grid).gap) || 0);
            const idx = Math.max(0, Math.min(count - 1, Math.round(grid.scrollLeft / step)));
            track.querySelectorAll('.cow-dot').forEach((d, i) => d.classList.toggle('is-active', i === idx));
            hint.textContent = idx >= count - 1 ? 'Tu as tout vu 🥖' : `Encore ${count - 1 - idx} à voir →`;
        });
    }, { passive: true });
}

// Après le vote (mobile) : bannière « A voté ! », le clip choisi en tête, les autres en petit
function applyVotedLayout(grid, votedClip) {
    if (!MOBILE_MQ.matches || !grid || !votedClip) return;
    const voteBlock = grid.closest('.cow-vote-block');
    if (!voteBlock || voteBlock.classList.contains('is-voted')) return;
    const cards = Array.from(grid.querySelectorAll('.cow-card'));
    const mine = cards.find(c => c.querySelector('.cow-vote-btn')?.dataset.clip === votedClip);
    if (!mine) return;

    voteBlock.classList.add('is-voted');
    mine.classList.add('is-mine');
    cards.forEach(c => { if (c !== mine) c.classList.add('is-other'); });
    grid.prepend(mine);

    const num = mine.dataset.num || '';
    const banner = makeEl('div', 'cow-voted-banner');
    banner.append(
        makeEl('p', 'cow-voted-title', 'A voté ! 🗳️'),
        makeEl('p', 'cow-voted-text', `Ton vote${num ? ` pour le n°${num}` : ''} est enregistré. Le résultat tombe dimanche à 21h en live, puis sur Discord.`)
    );
    const discord = makeEl('a', 'cow-voted-discord', 'Rejoindre Discord');
    discord.href = DISCORD_URL; discord.target = '_blank'; discord.rel = 'noopener';
    discord.setAttribute('data-umami-event', 'Clips - Discord apres vote');
    banner.appendChild(discord);
    grid.before(banner);

    if (cards.length > 1) {
        const others = cards.length - 1;
        mine.after(makeEl('p', 'cow-others-label', others > 1 ? `Les ${others} autres finalistes` : 'L\'autre finaliste'));
    }
}

function buildFinalistCard(clip, week, votedKey, num, total) {
    const card = makeEl('div', 'cow-card');
    if (num) card.dataset.num = String(num);
    card.appendChild(makeClipThumb(clip, 'Clips - Play Finalist'));
    if (num && total) {
        const badge = makeEl('span', 'cow-num', `${num} / ${total}`);
        badge.setAttribute('aria-hidden', 'true');
        card.appendChild(badge);
    }
    const meta = makeEl('p', 'clip-meta', `« ${clipDisplayTitle(clip)} »`);
    if (num) meta.dataset.num = String(num);
    card.appendChild(meta);
    if (clip.creator_name) {
        card.appendChild(makeEl('p', 'clip-clipper', `clippé par ${clip.creator_name}`));
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cow-vote-btn';
    btn.dataset.clip = clip.id;              // le vote est lié à l'identité du clip
    setBtnLabel(btn, 'Voter pour ce clip', true);
    btn.addEventListener('click', async () => {
        if (lsGet(votedKey) || btn.disabled) return;
        const status = document.getElementById('cowVoteStatus');
        // Compteur principal : le Worker Cloudflare (1 vote par IP et par semaine).
        // On ATTEND sa réponse avant de confirmer : un vote perdu (réseau coupé,
        // worker muet) doit laisser le bouton actif, jamais afficher un faux merci.
        btn.disabled = true;
        btn.textContent = 'Envoi…';
        try {
            const r = await fetch(`${VOTE_API}/vote/${week}/${encodeURIComponent(clip.id)}`, { method: 'POST' });
            const d = await r.json().catch(() => null);
            if (!r.ok || !d || d.ok !== true) throw new Error();
            // Umami seulement sur les votes réellement enregistrés
            try { window.umami?.track(`vote-${week}`, { clip: clip.id }); } catch { /* adblock : tant pis */ }
            lsSet(votedKey, clip.id);
            refreshVoteButtons(card.parentElement, clip.id);
            if (status) status.textContent = 'Vote enregistré, merci !';
        } catch {
            btn.disabled = false;
            setBtnLabel(btn, 'Oups, réessaie', false);
            if (status) status.textContent = 'Le vote n\'a pas pu être enregistré, réessaie.';
        }
    });
    card.appendChild(btn);
    return card;
}

// Le bloc gagnant n'apparaît qu'après la révélation en live (marqueur posé
// par le worker au clic d'annonce du board). Fail-closed volontaire : si le
// worker est muet, on ne révèle PAS (le teaser reste) — un spoiler raté est
// pire qu'un affichage retardé.
async function isWinnerRevealed(week) {
    const forced = testFlag('cow');
    if (forced === 'winner') return true;
    if (forced === 'teaser') return false;
    if (!VOTE_API || !week) return false;
    try {
        const r = await fetch(`${VOTE_API}/revealed/${encodeURIComponent(week)}`);
        if (!r.ok) return false;
        const d = await r.json();
        return d && d.revealed === true;
    } catch { return false; }
}

// Participation affichée sous le titre du vote : uniquement le TOTAL de
// votants (le worker ne révèle jamais qui mène : le suspense reste entier).
// Masqué sous 4 voix : "2 p'tits pains ont voté" ferait plus vide qu'incitatif.
async function showTurnout(week, after) {
    if (!after) return;
    const forcedTurnout = testFlag('turnout');
    if (forcedTurnout !== null) return renderTurnout(Number(forcedTurnout) || 0, after);
    if (!VOTE_API || !week) return;
    try {
        const r = await fetch(`${VOTE_API}/turnout/${encodeURIComponent(week)}`);
        if (!r.ok) return;
        const { count } = await r.json();
        renderTurnout(Number(count) || 0, after);
    } catch { /* silencieux : simple bonus d'ambiance */ }
}

// Masqué sous 4 voix : « 2 p'tits pains ont voté » ferait plus vide qu'incitatif.
function renderTurnout(n, after) {
    if (n <= 3) return;
    after.insertAdjacentElement('afterend',
        makeEl('p', 'cow-turnout', `${n} p'tits pains ont déjà voté !`));
    // Hero mobile : « Résultat dimanche 21h en live · 23 votes »
    const hero = document.getElementById('cowHeroTurnout');
    // Deux libelles : la pastille du desktop est plus bavarde que la mention
    // en fin de ligne du mobile, qui suit deja un point separateur.
    if (hero) {
        const s = n > 1 ? 's' : '';
        hero.textContent = '';
        hero.append(
            makeEl('span', 'meta-mobile', `Déjà ${n} vote${s}`),
            makeEl('span', 'meta-desktop', `Déjà ${n} vote${s} 🗳️`)
        );
        hero.hidden = false;
    }
}

function refreshVoteButtons(grid, votedClip) {
    if (!votedClip || !grid) return;
    grid.querySelectorAll('.cow-vote-btn').forEach(btn => {
        btn.disabled = true;
        if (btn.dataset.clip === votedClip) {
            btn.classList.add('is-voted');
            setBtnLabel(btn, 'Voté, merci !', true);
        }
    });
    applyVotedLayout(grid, votedClip);
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

        // Pseudo de chaque entrée, pour y accoler les couronnes une fois le
        // palmarès lu (sans retarder l'affichage du Panthéon)
        const nomParPseudo = {};

        // Un podium de trois cartes, puis les places 4 à 12 en
        // liste dans une seule carte. Chaque entrée : rang, pseudo et chiffres,
        // puis deux pastilles (le grade avec son emoji, la mention). Les
        // couronnes gagnées au vote s'accolent au pseudo.
        const podium = makeEl('ol', 'pantheon-podium');
        const liste = makeEl('ol', 'pantheon-list');
        liste.start = 4;
        clippers.forEach((c, i) => {
            const views = c.total_views || 0;
            const nbClips = c.clips || 0;
            // (c.clips || 0) : un champ manquant ne doit pas faire échouer le
            // find (undefined >= 0 est faux) et masquer tout le Panthéon.
            const badge = CLIPPER_BADGES.find(b => nbClips >= b.min);
            if (!badge) return;
            const suffix = CLIPPER_SUFFIXES.find(s => views >= s.min);

            const item = makeEl('li', i < 3 ? `pantheon-card pantheon-rang-${i + 1}` : 'pantheon-row');
            const ident = makeEl('div', 'pantheon-ident');
            const nom = makeEl('p', 'pantheon-name', c.name);
            nomParPseudo[String(c.name || '').toLowerCase()] = nom;
            ident.append(
                nom,
                makeEl('p', 'pantheon-stats',
                    `${nbClips} clip${nbClips > 1 ? 's' : ''} · ${views.toLocaleString('fr-FR')} vues`)
            );
            const tags = makeEl('p', 'pantheon-tags');
            tags.appendChild(makeEl('span', 'pantheon-tag pantheon-tag-grade', `${badge.emoji} ${badge.label}`));
            if (suffix) tags.appendChild(makeEl('span', 'pantheon-tag pantheon-tag-mention', suffix.label));
            item.append(makeEl('span', 'pantheon-rank', String(i + 1)), ident, tags);
            (i < 3 ? podium : liste).appendChild(item);
        });
        grid.appendChild(podium);
        if (liste.children.length) {
            // Desktop : la liste se lit par colonne (4 à 6, 7 à 9, 10 à 12),
            // il lui faut son nombre de lignes
            const rangs = Math.ceil(liste.children.length / 3);
            liste.style.setProperty('--rangs', rangs);
            // Bas de chaque colonne : pas de filet dessous (le CSS ne peut pas
            // le trouver seul, nth-child n'accepte pas de variable)
            [...liste.children].forEach((li, j) => {
                if ((j + 1) % rangs === 0) li.classList.add('pantheon-bas-colonne');
            });
            grid.appendChild(liste);
        }

        section.hidden = false;

        // Couronnes gagnées au vote du Clip de la Semaine, comptées par pseudo
        // sans tenir compte de la casse (Twitch et le palmarès ne l'écrivent
        // pas toujours pareil)
        const couronnes = {};
        (await chargerPalmares()).forEach(w => {
            const nom = String(w.creator_name || '').toLowerCase();
            if (nom) couronnes[nom] = (couronnes[nom] || 0) + 1;
        });
        Object.entries(couronnes).forEach(([nom, nb]) => {
            const cible = nomParPseudo[nom];
            if (!cible) return;
            const libelle = `${nb} couronne${nb > 1 ? 's' : ''} au Clip de la Semaine`;
            const couronne = makeEl('span', 'pantheon-couronne', `👑 ×${nb}`);
            couronne.title = libelle;
            couronne.setAttribute('aria-label', libelle);
            cible.appendChild(couronne);
        });
    } catch { /* silencieux : la section reste cachée */ }
}

// ── Le Palmarès ─────────────────────────────────────────────
// Les clips couronnés (data/hall-of-fame.json, complété par le workflow à
// chaque sacre), du plus récent au plus ancien, en cartes identiques aux
// derniers clips avec la date du sacre sur la vignette. Le dernier couronné
// reste caché tant que sa révélation en live n'a pas eu lieu : même verrou,
// fail-closed, que la carte du gagnant.
// Gagnants affichables, lus une seule fois pour le Palmarès et le compteur
// de couronnes du Panthéon : un sacre pas encore révélé n'apparaît nulle part.
let palmaresCharge = null;
function chargerPalmares() {
    if (!palmaresCharge) {
        palmaresCharge = (async () => {
            const [rHof, rCow] = await Promise.all([
                fetch('/data/hall-of-fame.json', { cache: 'no-store' }),
                fetch('/data/clip-of-week.json', { cache: 'no-store' }),
            ]);
            if (!rHof.ok) return [];
            const hof = await rHof.json();
            let winners = (Array.isArray(hof.winners) ? hof.winners : []).filter(w => w && w.id);

            const cow = rCow.ok ? await rCow.json() : null;
            const dernier = cow && cow.winner && cow.winner.id;
            if (dernier && !(await isWinnerRevealed(cow.week))) {
                winners = winners.filter(w => w.id !== dernier);
            }
            return winners;
        })().catch(() => []);
    }
    return palmaresCharge;
}

async function loadPalmares() {
    const section = document.getElementById('palmares');
    const grid = document.getElementById('palmaresGrid');
    if (!section || !grid || typeof buildClipCard !== 'function') return;

    try {
        const winners = [...await chargerPalmares()];
        if (!winners.length) return;

        winners.sort((a, b) => String(b.crowned_at || b.week).localeCompare(String(a.crowned_at || a.week)));
        winners.forEach(w => {
            const card = buildClipCard({ ...w, title: w.title || 'Clip sans titre' });
            const thumb = card.querySelector('.clip-thumb');
            if (thumb) {
                thumb.setAttribute('data-umami-event', 'Clips - Play Palmares');
                const sacre = w.crowned_at ? new Date(w.crowned_at) : null;
                if (sacre && !isNaN(sacre)) {
                    thumb.appendChild(makeEl('span', 'palmares-date',
                        `👑 ${sacre.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`));
                }
            }
            grid.appendChild(card);
        });
        section.hidden = false;
    } catch { /* silencieux : la section reste cachée */ }
}

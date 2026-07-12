// ============================================================
//  Bingo des lives — grille 4×4 seedée par la date (Europe/Paris)
//  Toute la communauté a la MÊME grille un soir donné. Cases cochées
//  gardées en localStorage (remises à zéro chaque jour). Bingo = une
//  ligne / colonne / diagonale complète → confettis + partage.
// ============================================================
(function initBingo() {
    const grid = document.getElementById('bingoGrid');
    if (!grid) return;

    // ── Date du jour côté Paris (clé de seed + de sauvegarde) ──
    const dateStr = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date()); // AAAA-MM-JJ
    const keyChecked = `bingo-${dateStr}`;
    const keyWon = `bingo-won-${dateStr}`;

    // ── PRNG déterministe seedé par la date ──
    function hashStr(s) {
        let h = 1779033703 ^ s.length;
        for (let i = 0; i < s.length; i++) {
            h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
            h = (h << 13) | (h >>> 19);
        }
        return h >>> 0;
    }
    function mulberry32(a) {
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    const LINES = [
        [0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15], // lignes
        [0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15],  // colonnes
        [0, 5, 10, 15], [3, 6, 9, 12]                                   // diagonales
    ];

    const checked = new Set(JSON.parse(localStorage.getItem(keyChecked) || '[]'));

    fetch('/data/bingo-items.json')
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => {
            const pool = Array.isArray(data.items) ? data.items.slice() : [];
            if (pool.length < 16) return;

            // Mélange seedé, puis 16 cases pour la grille du jour
            const rng = mulberry32(hashStr(dateStr));
            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(rng() * (i + 1));
                [pool[i], pool[j]] = [pool[j], pool[i]];
            }
            const cells = pool.slice(0, 16);

            grid.innerHTML = '';
            cells.forEach((text, i) => {
                const cell = document.createElement('button');
                cell.type = 'button';
                cell.className = 'bingo-cell' + (checked.has(i) ? ' is-checked' : '');
                cell.setAttribute('aria-pressed', checked.has(i) ? 'true' : 'false');
                cell.textContent = text;
                cell.addEventListener('click', () => toggle(i, cell));
                grid.appendChild(cell);
            });

            document.getElementById('bingoBoard').hidden = false;
            checkBingo(false); // au chargement : réaffiche le bandeau si déjà gagné, sans confettis
        })
        .catch(() => { /* silencieux : la grille reste masquée */ });

    function toggle(i, cell) {
        const on = !checked.has(i);
        if (on) checked.add(i); else checked.delete(i);
        cell.classList.toggle('is-checked', on);
        cell.setAttribute('aria-pressed', on ? 'true' : 'false');
        localStorage.setItem(keyChecked, JSON.stringify([...checked]));
        try { window.umami?.track('Bingo - Case'); } catch { }
        checkBingo(true);
    }

    function checkBingo(justClicked) {
        const win = LINES.some(line => line.every(idx => checked.has(idx)));
        const msg = document.getElementById('bingoWin');
        if (msg) msg.hidden = !win;
        if (win && !localStorage.getItem(keyWon)) {
            localStorage.setItem(keyWon, '1');
            try { window.umami?.track('Bingo - Gagné'); } catch { }
            if (justClicked && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) confetti();
        }
    }

    // ── Confettis maison (canvas, aucune lib externe → compatible CSP) ──
    function confetti() {
        const canvas = document.createElement('canvas');
        canvas.className = 'bingo-confetti';
        canvas.width = innerWidth;
        canvas.height = innerHeight;
        document.body.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        const colors = ['#7fb893', '#f2c96b', '#c56a52', '#d64e4e', '#5c936f'];
        const parts = Array.from({ length: 90 }, () => ({
            x: Math.random() * canvas.width,
            y: -20 - Math.random() * canvas.height * 0.5,
            r: 4 + Math.random() * 6,
            c: colors[Math.floor(Math.random() * colors.length)],
            vx: -2 + Math.random() * 4,
            vy: 2 + Math.random() * 4,
            rot: Math.random() * Math.PI,
            vr: -0.2 + Math.random() * 0.4
        }));
        const start = performance.now();
        (function frame(now) {
            const t = now - start;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            parts.forEach(p => {
                p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.vy += 0.03;
                ctx.save();
                ctx.translate(p.x, p.y); ctx.rotate(p.rot);
                ctx.fillStyle = p.c;
                ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6);
                ctx.restore();
            });
            if (t < 2800) requestAnimationFrame(frame);
            else canvas.remove();
        })(start);
    }

    // ── Partage : récap ✅/⬜ à coller dans le Discord ──
    const shareBtn = document.getElementById('bingoShare');
    if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
            let g = '';
            for (let r = 0; r < 4; r++) {
                for (let c = 0; c < 4; c++) g += checked.has(r * 4 + c) ? '🟩' : '⬜';
                g += '\n';
            }
            const d = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long' }).format(new Date());
            const text = `🎲 Bingo Baguette Chaussette — ${d}\n${g}baguettechaussette.fr/bingo`;
            try { window.umami?.track('Bingo - Partage'); } catch { }
            if (navigator.share) {
                try { await navigator.share({ text }); return; } catch { /* annulé */ }
            }
            try {
                await navigator.clipboard.writeText(text);
                shareBtn.textContent = 'Copié ✓';
                setTimeout(() => { shareBtn.textContent = 'Partager ma grille'; }, 1800);
            } catch { /* presse-papier indispo */ }
        });
    }
})();

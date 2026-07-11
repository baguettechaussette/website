// Countdown des streams
// Architecture séparée :
//   - tick()         → s'exécute toutes les 1s, met à jour UNIQUEMENT les textes countdown
//   - pollLive()     → s'exécute toutes les 30s, fetch live-status.json
//   - updateUI()     → re-render complet du DOM, appelé seulement si l'état change (diff)
(function initStreamCountdown() {
    const STREAM_DURATION_MS = (3 * 60 + 30) * 60 * 1000; // 3h30
    const TWITCH_URL         = "https://www.twitch.tv/baguettechaussette";
    const LIVE_STATUS_URL    = "/data/live-status.json";

    // ─── Cache d'état : on compare avant de toucher au DOM ───────────────────
    let cachedIsLive  = null; // null = jamais initialisé
    let cachedNextKey = null; // "day-hour-minute" du prochain créneau
    let liveOverride  = false;

    // ─── Helpers (identiques à ta version originale) ─────────────────────────

    function getScheduleFromDOM() {
        return Array.from(document.querySelectorAll(".schedule-item")).map((el) => ({
            day:    +el.dataset.day,
            hour:   +el.dataset.hour,
            minute: +el.dataset.minute || 0,
            el,
        }));
    }

    function nextOccurrenceOf({ day, hour, minute }, now = new Date()) {
        const next = new Date(now);
        let daysUntil = day - now.getDay();
        if (daysUntil < 0) daysUntil += 7;
        next.setDate(now.getDate() + daysUntil);
        next.setHours(hour, minute, 0, 0);
        if (next <= now) next.setDate(next.getDate() + 7);
        return next;
    }

    function isNowInWindow(start, now = new Date()) {
        return now >= start && now < new Date(start.getTime() + STREAM_DURATION_MS);
    }

    function getCurrentOrNext(schedule) {
        const now = new Date();

        for (const s of schedule) {
            const startToday = new Date(now);
            startToday.setHours(s.hour, s.minute, 0, 0);
            if (now.getDay() === s.day && isNowInWindow(startToday, now))
                return { ...s, date: startToday, isLive: true };

            const startYesterday = new Date(startToday);
            startYesterday.setDate(startYesterday.getDate() - 1);
            if ((now.getDay() + 6) % 7 === s.day && isNowInWindow(startYesterday, now))
                return { ...s, date: startYesterday, isLive: true };
        }

        let nextSlot = null, minDiff = Infinity;
        for (const s of schedule) {
            const next = nextOccurrenceOf(s, now);
            const diff = next - now;
            if (diff < minDiff) {
                minDiff  = diff;
                nextSlot = { ...s, date: next, diff, isLive: false };
            }
        }
        return nextSlot;
    }

    function formatCountdown(ms) {
        const total   = Math.max(0, Math.floor(ms / 1000));
        const days    = Math.floor(total / 86400);
        const hours   = Math.floor((total % 86400) / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const seconds = total % 60;

        if (days > 1)    return `${days} jours ${hours}h ${minutes}min`;
        if (days === 1)  return `1 jour ${hours}h ${minutes}min`;
        if (hours > 0)   return `${hours}h ${minutes}min ${seconds}s`;
        if (minutes > 0) return `${minutes}min ${seconds}s`;
        return `${seconds}s`;
    }

    const formatTime = (h, m) =>
        `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}`;

    const getDayName = (d) =>
        ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"][d];

    // ─── Fetch live-status.json (30s) ─────────────────────────────────────────

    let liveMeta = null; // {game, title, started_at} si le workflow enrichi a tourné

    async function pollLive() {
        try {
            const r = await fetch(LIVE_STATUS_URL, { cache: "no-store" });
            if (!r.ok) return;
            const json    = await r.json();
            const newLive = !!(json && json.is_live);
            liveMeta      = newLive ? json : null;
            if (newLive !== liveOverride) {
                liveOverride  = newLive;
                cachedIsLive  = null; // invalide le cache → force re-render au prochain tick
            } else if (newLive) {
                renderLiveMeta(); // le jeu peut changer en cours de stream
            }
        } catch { /* silencieux */ }
    }

    // Ligne "🎮 jeu en cours" de la bannière live (textContent : pas d'injection HTML)
    function renderLiveMeta() {
        const el = document.getElementById("liveBannerMeta");
        if (!el) return;
        const text = liveMeta && liveMeta.game ? `🎮 En ce moment : ${liveMeta.game}` : "";
        el.textContent = text;
        el.hidden = !text;
    }

    // ─── Re-render complet (appelé seulement si l'état change) ───────────────

    function updateUI(isLive, info) {
        const banner = document.getElementById("nextStreamCountdown");
        if (!banner) return;

        if (isLive) {
            banner.classList.add("is-live");
            banner.innerHTML = `
                <div class="countdown-label">🔴 EN LIVE MAINTENANT</div>
                <h2 class="countdown-time">On n'attend plus que toi !</h2>
                <p class="countdown-live-meta" id="liveBannerMeta" hidden></p>
                <a href="${TWITCH_URL}" target="_blank" rel="noopener" class="countdown-cta live">REJOINDRE LE STREAM</a>
            `;
            renderLiveMeta();
        } else {
            banner.classList.remove("is-live");
            // Le span #bannerText est ciblé par tick() pour mettre à jour le countdown sans innerHTML
            banner.innerHTML = `
                <div class="countdown-label">Prochain stream — ${getDayName(info.day)} ${formatTime(info.hour, info.minute)}</div>
                <h2 class="countdown-time"><span id="bannerText">Dans ${formatCountdown(info.diff)}</span> ⌛</h2>
                <a href="${TWITCH_URL}" target="_blank" rel="noopener" class="countdown-cta upcoming">Suivre la chaîne ♥</a>
            `;
        }

        // Classes des cartes (is-next / is-live)
        getScheduleFromDOM().forEach(({ day, hour, minute, el }) => {
            const now        = new Date();
            const startToday = new Date(now);
            startToday.setHours(hour, minute, 0, 0);
            const isThisLive = now.getDay() === day && isNowInWindow(startToday, now);

            el.classList.remove("is-next", "is-live");
            if (isThisLive) {
                el.classList.add("is-live");
            } else if (!info.isLive && day === info.day && hour === info.hour && minute === info.minute) {
                el.classList.add("is-next");
            }
        });
    }

    // ─── Ticker 1s : textes uniquement, zéro innerHTML ───────────────────────

    function tick() {
        const schedule = getScheduleFromDOM();
        if (!schedule.length) return;

        const info   = getCurrentOrNext(schedule);
        if (!info) return;

        const isLive = liveOverride || info.isLive;
        const key    = `${info.day}-${info.hour}-${info.minute}`;

        // Changement d'état → re-render complet (rare)
        if (cachedIsLive !== isLive || cachedNextKey !== key) {
            cachedIsLive  = isLive;
            cachedNextKey = key;
            updateUI(isLive, info);
            return; // updateUI a déjà écrit les textes initiaux
        }

        // Même état → on met à jour uniquement les textes countdown (1s)
        const now = new Date();

        if (!isLive) {
            const bannerText = document.getElementById("bannerText");
            if (bannerText) {
                bannerText.textContent = `Dans ${formatCountdown(info.date - now)}`;
            }
        }

        schedule.forEach(({ day, hour, minute, el }) => {
            const cdEl = el.querySelector(".schedule-countdown");
            if (!cdEl) return;

            const startToday = new Date(now);
            startToday.setHours(hour, minute, 0, 0);

            if (now.getDay() === day && isNowInWindow(startToday, now)) {
                if (cdEl.textContent !== "En cours") cdEl.textContent = "En cours";
            } else {
                const next    = nextOccurrenceOf({ day, hour, minute }, now);
                const newText = `Dans ${formatCountdown(next - now)}`;
                if (cdEl.textContent !== newText) cdEl.textContent = newText;
            }
        });
    }

    // ─── Grille du planning depuis data/schedule.json ────────────────────────
    // Source de vérité unique : la grille HTML statique sert de fallback no-JS,
    // mais dès que le JSON est chargé, c'est lui qui fait foi.

    async function renderSchedule() {
        const grid = document.querySelector(".schedule-grid");
        if (!grid) return;
        try {
            const r = await fetch("/data/schedule.json", { cache: "no-store" });
            if (!r.ok) return;
            const json = await r.json();
            const slots = Array.isArray(json?.slots) ? json.slots : [];
            if (!slots.length) return;

            grid.innerHTML = slots.map(s => `
                <article class="schedule-item" data-day="${+s.day}" data-hour="${+s.hour}" data-minute="${+s.minute || 0}">
                    <div class="schedule-day">${getDayName(+s.day)}</div>
                    <div class="schedule-time">${formatTime(+s.hour, +s.minute || 0)}</div>
                    <div class="schedule-countdown"></div>
                </article>`).join("");
        } catch { /* silencieux : la grille HTML statique reste affichée */ }
    }

    // ─── Init ─────────────────────────────────────────────────────────────────

    async function init() {
        await renderSchedule();        // grille depuis data/schedule.json
        await pollLive();              // fetch live-status avant le premier rendu
        tick();                        // rendu immédiat

        let tickInterval = setInterval(tick,     1_000);
        let pollInterval = setInterval(pollLive, 30_000);

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                clearInterval(tickInterval);
                clearInterval(pollInterval);
            } else {
                pollLive();
                tick();
                tickInterval = setInterval(tick,     1_000);
                pollInterval = setInterval(pollLive, 30_000);
            }
        });
    }

    init();
})();
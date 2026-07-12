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

    // ─── Fuseau horaire : le planning est en heure de Paris, pas celle du visiteur ──
    // Un p'tit pain à Montréal doit voir un décompte vers 21h de Paris (15h chez lui).

    const SCHEDULE_TZ = "Europe/Paris";

    // Formatters créés une seule fois (tick tourne chaque seconde)
    const TZ_OFFSET_DTF = new Intl.DateTimeFormat("en-US", {
        timeZone: SCHEDULE_TZ, hour12: false,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    const TZ_PARTS_DTF = new Intl.DateTimeFormat("en-US", {
        timeZone: SCHEDULE_TZ,
        year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
    });
    const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

    // Décalage (ms) entre l'heure murale de Paris et l'UTC à un instant donné
    function tzOffsetMs(date) {
        const p = {};
        for (const { type, value } of TZ_OFFSET_DTF.formatToParts(date)) p[type] = value;
        const wallAsUTC = Date.UTC(+p.year, p.month - 1, +p.day, p.hour % 24, +p.minute, +p.second);
        return wallAsUTC - date.getTime();
    }

    // Date calendaire et jour de semaine actuels côté Paris
    function parisParts(now) {
        const p = {};
        for (const { type, value } of TZ_PARTS_DTF.formatToParts(now)) p[type] = value;
        return { y: +p.year, m: +p.month, d: +p.day, weekday: WEEKDAYS[p.weekday] };
    }

    // Prochaine occurrence réelle (UTC) d'un créneau "jour J à HH:MM heure de Paris".
    // Double passe sur l'offset pour absorber les changements d'heure été/hiver.
    function nextOccurrenceOf({ day, hour, minute }, now = new Date()) {
        const p = parisParts(now);
        let daysUntil = day - p.weekday;
        if (daysUntil < 0) daysUntil += 7;

        const toUTC = (plusDays) => {
            const guess = Date.UTC(p.y, p.m - 1, p.d + daysUntil + plusDays, hour, minute, 0);
            let utc = guess - tzOffsetMs(new Date(guess));
            utc = guess - tzOffsetMs(new Date(utc));
            return utc;
        };

        let utc = toUTC(0);
        if (utc <= now.getTime()) utc = toUTC(7);
        return new Date(utc);
    }

    // Dernière occurrence passée du créneau (pour détecter une fenêtre live en cours).
    // Approximation -7j : à cheval sur un changement d'heure elle glisse d'1h, sans
    // conséquence réelle (le statut live affiché vient de live-status.json).
    function lastOccurrenceOf(slot, now = new Date()) {
        return new Date(nextOccurrenceOf(slot, now).getTime() - 7 * 86400000);
    }

    function isNowInWindow(start, now = new Date()) {
        return now >= start && now < new Date(start.getTime() + STREAM_DURATION_MS);
    }

    function getCurrentOrNext(schedule) {
        const now = new Date();

        for (const s of schedule) {
            const last = lastOccurrenceOf(s, now);
            if (isNowInWindow(last, now))
                return { ...s, date: last, isLive: true };
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

    // Ligne "🎮 jeu en cours" ajoutée à la carte live (textContent : pas d'injection HTML)
    function renderLiveMeta() {
        const el = document.querySelector(".schedule-item.is-live .schedule-live-game");
        if (!el) return;
        const text = liveMeta && liveMeta.game ? `🎮 ${liveMeta.game}` : "";
        el.textContent = text;
        el.hidden = !text;
    }

    // Ajoute / met à jour / retire le CTA (et la ligne jeu) d'une carte planning
    function setCardCta(el, type) {
        let cta  = el.querySelector(".schedule-cta");
        let game = el.querySelector(".schedule-live-game");

        if (!type) {
            cta?.remove();
            game?.remove();
            return;
        }

        // La ligne jeu (live uniquement) se place avant le CTA
        if (type === "live") {
            if (!game) {
                game = document.createElement("p");
                game.className = "schedule-live-game";
                game.hidden = true;
                el.appendChild(game);
            }
        } else {
            game?.remove();
        }

        if (!cta) {
            cta = document.createElement("a");
            cta.className = "schedule-cta";
            cta.target = "_blank";
            cta.rel = "noopener";
            cta.href = TWITCH_URL;
            el.appendChild(cta);
        }
        cta.classList.toggle("live", type === "live");
        cta.textContent = type === "live" ? "Viens te poser 🧦" : "Suivre la chaîne ♥";
        cta.setAttribute("data-umami-event", type === "live" ? "Planning - Rejoindre le live" : "Planning - Suivre la chaine");
    }

    // ─── Re-render (appelé seulement si l'état change) ───────────────────────
    // Plus de bannière séparée : la carte du créneau concerné porte l'état.
    // info = créneau courant (si live) ou prochain créneau (sinon).

    function updateUI(isLive, info) {
        getScheduleFromDOM().forEach(({ day, hour, minute, el }) => {
            const isThisSlot = day === info.day && hour === info.hour && minute === info.minute;

            el.classList.remove("is-next", "is-live");
            if (isLive && isThisSlot) {
                el.classList.add("is-live");
                setCardCta(el, "live");
            } else if (!isLive && isThisSlot) {
                el.classList.add("is-next");
                setCardCta(el, "next");
            } else {
                setCardCta(el, null);
            }
        });
        renderLiveMeta();
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

        schedule.forEach(({ day, hour, minute, el }) => {
            const cdEl = el.querySelector(".schedule-countdown");
            if (!cdEl) return;

            // La carte live (classe posée par updateUI) affiche "En direct",
            // les autres leur décompte.
            if (el.classList.contains("is-live")) {
                if (cdEl.textContent !== "En direct") cdEl.textContent = "En direct";
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
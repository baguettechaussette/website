(function initStreamCountdown() {
    const STREAM_DURATION_MS = (3 * 60 + 30) * 60 * 1000;
    const TWITCH_URL         = "https://www.twitch.tv/baguettechaussette";
    const LIVE_STATUS_URL    = "https://bc-vote.baguette-chaussette.workers.dev/live";

    // Cache d'état
    let cachedIsLive  = null;
    let cachedNextKey = null;
    let liveOverride  = false;

    const MOBILE_MQ = window.matchMedia("(max-width: 768px)");

    const HEART_SVG = '<svg class="btn-heart" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
    const heartTpl = document.createElement('template');
    heartTpl.innerHTML = HEART_SVG;
    function setCtaLabel(el, isLive) {
        if (!el) return;
        el.textContent = isLive ? "Viens te poser" : "Suivre la chaîne";
        if (!isLive) el.appendChild(heartTpl.content.firstElementChild.cloneNode(true));
    }

    const hero = {
        card:  document.getElementById("heroLive"),
        label: document.getElementById("heroLiveLabel"),
        cd:    document.getElementById("heroLiveCountdown"),
        value: document.getElementById("heroLiveValue"),
        game:  document.getElementById("heroLiveGame"),
        cta:   document.getElementById("heroLiveCta"),
    };

    // Helpers

    function getScheduleFromDOM() {
        return Array.from(document.querySelectorAll(".schedule-item")).map((el) => ({
            day:    +el.dataset.day,
            hour:   +el.dataset.hour,
            minute: +el.dataset.minute || 0,
            el,
        }));
    }

    // Fuseau horaire

    const SCHEDULE_TZ = "Europe/Paris";

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

    function tzOffsetMs(date) {
        const p = {};
        for (const { type, value } of TZ_OFFSET_DTF.formatToParts(date)) p[type] = value;
        const wallAsUTC = Date.UTC(+p.year, p.month - 1, +p.day, p.hour % 24, +p.minute, +p.second);
        return wallAsUTC - date.getTime();
    }

    function parisParts(now) {
        const p = {};
        for (const { type, value } of TZ_PARTS_DTF.formatToParts(now)) p[type] = value;
        return { y: +p.year, m: +p.month, d: +p.day, weekday: WEEKDAYS[p.weekday] };
    }

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

        if (days > 1)    return hours > 0 ? `${days} jours ${hours}h` : `${days} jours`;
        if (days === 1)  return hours > 0 ? `1 jour ${hours}h` : `1 jour`;
        if (hours > 0)   return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
        if (minutes > 0) return `${minutes}min ${seconds}s`;
        return `${seconds}s`;
    }

    function formatCountdownShort(ms) {
        const total   = Math.max(0, Math.floor(ms / 1000));
        const days    = Math.floor(total / 86400);
        const hours   = Math.floor((total % 86400) / 3600);
        const minutes = Math.floor((total % 3600) / 60);

        if (days > 0)    return hours > 0 ? `${days} j ${hours} h` : `${days} j`;
        if (hours > 0)   return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
        if (minutes > 0) return `${minutes} min`;
        return "moins d'une minute";
    }

    function formatUptime(ms) {
        const total   = Math.max(0, Math.floor(ms / 1000));
        const hours   = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        if (hours > 0) return `${hours} h ${String(minutes).padStart(2, "0")}`;
        if (minutes > 0) return `${minutes} min`;
        return "quelques instants";
    }

    function liveSinceText() {
        const started = liveMeta && liveMeta.started_at ? Date.parse(liveMeta.started_at) : NaN;
        if (!Number.isFinite(started)) return "sur Twitch";
        return `sur Twitch, depuis ${formatUptime(Date.now() - started)}`;
    }

    const formatTime = (h, m) =>
        `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}`;

    const getDayName = (d) =>
        ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"][d];

    // Fetch live-status.json

    let liveMeta = null;

    let liveFails = 0;

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

    async function pollLive() {
        try {
            let json = forcedLiveForTests();
            if (!json) {
                const r = await fetch(LIVE_STATUS_URL, { cache: "no-store" });
                if (!r.ok) throw new Error(String(r.status));
                json = await r.json();
            }
            liveFails     = 0;
            const newLive = !!(json && json.is_live);
            liveMeta      = newLive ? json : null;
            if (newLive !== liveOverride) {
                liveOverride  = newLive;
                cachedIsLive  = null;
            } else if (newLive) {
                renderLiveMeta();
            }
        } catch {
            if (++liveFails >= 3 && liveOverride) {
                liveOverride = false;
                liveMeta     = null;
                cachedIsLive = null;
            }
        }
    }

    function renderLiveMeta() {
        const text = liveMeta && liveMeta.game ? liveMeta.game : "";
        const el = document.querySelector(".schedule-item.is-live .schedule-live-game");
        if (el) {
            el.textContent = text;
            el.hidden = !text;
        }
        if (hero.value && liveMeta) {
            const titre = text || "Ça se passe maintenant !";
            if (hero.value.textContent !== titre) hero.value.textContent = titre;
        }
        if (hero.game) {
            const sous = liveMeta ? liveSinceText() : "";
            if (hero.game.textContent !== sous) hero.game.textContent = sous;
            hero.game.hidden = !sous;
        }
    }

    function reserveLiveLine() {
        if (!hero.game) return;
        const prevu = getCurrentOrNext(getScheduleFromDOM());
        if (!prevu || !prevu.isLive) return;
        const skel = document.createElement("span");
        skel.className = "hero-skel hero-skel-court";
        skel.setAttribute("aria-hidden", "true");
        hero.game.replaceChildren(skel);
        hero.game.hidden = false;
    }

    function renderHero(isLive, info) {
        if (!hero.card) return;
        if (!isLive && hero.game) {
            hero.game.textContent = "";
            hero.game.hidden = true;
        }
        hero.card.classList.toggle("is-live", isLive);
        hero.label.textContent = isLive ? "En direct" : "Prochain live";
        hero.value.textContent = isLive
            ? (liveMeta && liveMeta.game ? liveMeta.game : "Ça se passe maintenant !")
            : `${getDayName(info.day)} ${formatTime(info.hour, info.minute)}`;
        if (isLive) renderLiveMeta();
        setCtaLabel(hero.cta, isLive);
        hero.cta.setAttribute("data-umami-event", isLive ? "Hero - Rejoindre le live" : "Hero - Suivre la chaine");
        if (isLive && hero.cd) hero.cd.textContent = "";
    }

    function setCardCta(el, type) {
        let cta  = el.querySelector(".schedule-cta");
        let game = el.querySelector(".schedule-live-game");

        if (!type) {
            cta?.remove();
            game?.remove();
            return;
        }

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
        setCtaLabel(cta, type === "live");
        cta.setAttribute("data-umami-event", type === "live" ? "Planning - Rejoindre le live" : "Planning - Suivre la chaine");
    }

    // Re-render

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
        renderHero(isLive, info);
        renderLiveMeta();
    }

    // Ticker 1s

    function tick() {
        const schedule = getScheduleFromDOM();
        if (!schedule.length) return;

        const info   = getCurrentOrNext(schedule);
        if (!info) return;

        const isLive = liveOverride || info.isLive;
        const key    = `${info.day}-${info.hour}-${info.minute}`;

        if (cachedIsLive !== isLive || cachedNextKey !== key) {
            cachedIsLive  = isLive;
            cachedNextKey = key;
            updateUI(isLive, info);
        }

        const now     = new Date();
        const compact = MOBILE_MQ.matches;

        schedule.forEach(({ day, hour, minute, el }) => {
            const cdEl = el.querySelector(".schedule-countdown");
            if (!cdEl) return;

            if (el.classList.contains("is-live")) {
                if (cdEl.textContent !== "En direct") cdEl.textContent = "En direct";
            } else {
                const next    = nextOccurrenceOf({ day, hour, minute }, now);
                const newText = compact
                    ? `dans ${formatCountdownShort(next - now)}`
                    : `dans ${formatCountdown(next - now)}`;
                if (cdEl.textContent !== newText) cdEl.textContent = newText;
            }
        });

        if (hero.cd && !isLive && info.date) {
            const t = `dans ${formatCountdownShort(info.date - now)}`;
            if (hero.cd.textContent !== t) hero.cd.textContent = t;
        } else if (isLive) {
            renderLiveMeta();
        }
    }

    // Grille du planning depuis data/schedule.json

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
        } catch {}
    }

    // Init

    async function init() {
        reserveLiveLine();
        await renderSchedule();
        await pollLive();
        tick();

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
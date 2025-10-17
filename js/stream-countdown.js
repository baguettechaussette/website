// Countdown des streams avec gestion améliorée des fuseaux horaires et de la logique
(function initStreamCountdown() {
    const STREAM_DURATION_MS = (3 * 60 + 30) * 60 * 1000; // 3h30
    const TWITCH_URL = "https://www.twitch.tv/baguettechaussette";

    // Récupère le planning depuis le DOM
    function getScheduleFromDOM() {
        return Array.from(document.querySelectorAll(".schedule-item")).map((el) => ({
            day: +el.dataset.day,
            hour: +el.dataset.hour,
            minute: +el.dataset.minute || 0,
            el,
        }));
    }

    // Calcule la prochaine occurrence d'un créneau donné
    function nextOccurrenceOf({ day, hour, minute }, now = new Date()) {
        const next = new Date(now);
        const nowDay = now.getDay();

        // Calcul des jours jusqu'au prochain créneau
        let daysUntil = day - nowDay;
        if (daysUntil < 0) daysUntil += 7;

        next.setDate(now.getDate() + daysUntil);
        next.setHours(hour, minute, 0, 0);

        // Si l'heure est déjà passée aujourd'hui, on passe à la semaine prochaine
        if (next <= now) {
            next.setDate(next.getDate() + 7);
        }

        return next;
    }

    // Vérifie si on est actuellement dans la fenêtre de stream
    function isNowInWindow(start, now = new Date()) {
        const end = new Date(start.getTime() + STREAM_DURATION_MS);
        return now >= start && now < end;
    }

    // Trouve le stream actuel ou le prochain
    function getCurrentOrNext(schedule) {
        const now = new Date();

        // Vérifie d'abord si un stream est en cours
        for (const s of schedule) {
            const startToday = new Date(now);
            startToday.setHours(s.hour, s.minute, 0, 0);

            // Vérifie aujourd'hui
            if (now.getDay() === s.day && isNowInWindow(startToday, now)) {
                return { ...s, date: startToday, isLive: true };
            }

            // Vérifie hier (au cas où le stream a commencé hier soir et dure encore)
            const startYesterday = new Date(startToday);
            startYesterday.setDate(startYesterday.getDate() - 1);
            if ((now.getDay() + 6) % 7 === s.day && isNowInWindow(startYesterday, now)) {
                return { ...s, date: startYesterday, isLive: true };
            }
        }

        // Sinon, trouve le prochain stream
        let nextSlot = null;
        let minDiff = Infinity;

        for (const s of schedule) {
            const next = nextOccurrenceOf(s, now);
            const diff = next - now;

            if (diff < minDiff) {
                minDiff = diff;
                nextSlot = { ...s, date: next, diff, isLive: false };
            }
        }

        return nextSlot;
    }

    // Format countdown amélioré
    function formatCountdown(ms) {
        const totalSeconds = Math.max(0, Math.floor(ms / 1000));
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (days > 1) return `${days} jours ${hours}h ${minutes}min`;
        if (days === 1) return `1 jour ${hours}h ${minutes}min`;
        if (hours > 0) return `${hours}h ${minutes}min ${seconds}s`;
        if (minutes > 0) return `${minutes}min ${seconds}s`;
        return `${seconds}s`;
    }

    // Utilitaires de formatage
    const formatTime = (h, m) =>
        `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}`;

    const getDayName = (d) =>
        ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"][d];

    // Mise à jour de l'interface
    function updateUI() {
        const schedule = getScheduleFromDOM();
        const banner = document.getElementById("nextStreamCountdown");

        if (!banner || schedule.length === 0) return;

        const now = new Date();
        const info = getCurrentOrNext(schedule);

        if (!info) return;

        // Bannière principale
        if (info.isLive) {
            banner.classList.add("is-live");
            const endTime = new Date(info.date.getTime() + STREAM_DURATION_MS);
            const remaining = endTime - now;

            banner.innerHTML = `
                <div class="countdown-label">🔴 EN LIVE MAINTENANT</div>
                <div class="countdown-time">On n’attend plus que toi !</div>
                <a href="${TWITCH_URL}" target="_blank" rel="noopener" class="countdown-cta live">
                    REJOINDRE LE STREAM
                </a>
            `;
        } else {
            banner.classList.remove("is-live");
            banner.innerHTML = `
                <div class="countdown-label">
                    Prochain stream — ${getDayName(info.day)} ${formatTime(info.hour, info.minute)}
                </div>
                <div class="countdown-time">Dans ${formatCountdown(info.diff)} ⌛</div>
                <a href="${TWITCH_URL}" target="_blank" rel="noopener" class="countdown-cta upcoming">
                    Suivre la chaîne 💜
                </a>
            `;
        }

        // --- Synchronisation avec le live indicator global ---
        const liveIndicator = document.querySelector('.live-indicator');
        if (liveIndicator) {
            if (info.isLive) {
                liveIndicator.classList.remove('offline');
                liveIndicator.classList.add('active');
                liveIndicator.innerHTML = `
            <span class="live-dot" aria-hidden="true"></span>
            EN LIVE
        `;
                document.querySelector('.live-container')?.classList.add('is-live');
                document.querySelector('.live-container')?.classList.remove('is-offline');
            } else {
                liveIndicator.classList.remove('active');
                liveIndicator.classList.add('offline');
                liveIndicator.innerHTML = `
            <span class="live-dot" aria-hidden="true"></span>
            HORS LIGNE
        `;
                document.querySelector('.live-container')?.classList.add('is-offline');
                document.querySelector('.live-container')?.classList.remove('is-live');
            }
        }


        // Mise à jour des cartes de planning
        document.querySelectorAll(".schedule-item").forEach((card) => {
            const d = +card.dataset.day;
            const h = +card.dataset.hour;
            const m = +card.dataset.minute || 0;
            const cdEl = card.querySelector(".schedule-countdown");

            if (!cdEl) return;

            // Calcule la prochaine occurrence de ce créneau
            const nextStart = nextOccurrenceOf({ day: d, hour: h, minute: m }, now);

            // Vérifie si ce créneau est en cours maintenant
            const todayStart = new Date(now);
            todayStart.setHours(h, m, 0, 0);

            let isThisSlotLive = false;
            if (now.getDay() === d && isNowInWindow(todayStart, now)) {
                isThisSlotLive = true;
            }

            card.classList.remove("is-next", "is-live");

            if (isThisSlotLive) {
                card.classList.add("is-live");
                const endTime = new Date(todayStart.getTime() + STREAM_DURATION_MS);
                const remaining = endTime - now;
                cdEl.textContent = `🔴 En cours — reste ${formatCountdown(remaining)}`;
            } else {
                const diffMs = nextStart - now;
                cdEl.textContent = `Dans ${formatCountdown(diffMs)}`;

                // Marque comme "prochain" si c'est le stream le plus proche
                if (!info.isLive && d === info.day && h === info.hour && m === info.minute) {
                    card.classList.add("is-next");
                }
            }
        });
    }

    // Initialisation et mise à jour continue
    updateUI();
    setInterval(updateUI, 1000);
})();
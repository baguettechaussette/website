// Countdown des streams (durée ~3h30 + affichage jours/heures + CTA)
(function initStreamCountdown() {
    const STREAM_DURATION_MS = (3 * 60 + 30) * 60 * 1000; // 3h30
    const TWITCH_URL = "https://www.twitch.tv/baguettechaussette";

    function getScheduleFromDOM() {
        return Array.from(document.querySelectorAll(".schedule-item")).map((el) => ({
            day: +el.dataset.day,
            hour: +el.dataset.hour,
            minute: +el.dataset.minute || 0,
            el,
        }));
    }

    function nextOccurrenceOf({ day, hour, minute }, now = new Date()) {
        const next = new Date(now);
        const nowDay = now.getDay();
        let daysUntil = day - nowDay;
        if (daysUntil < 0) daysUntil += 7;
        next.setDate(now.getDate() + daysUntil);
        next.setHours(hour, minute, 0, 0);
        if (next <= now) next.setDate(next.getDate() + 7);
        return next;
    }

    function isNowInWindow(start, now = new Date()) {
        const end = new Date(start.getTime() + STREAM_DURATION_MS);
        return now >= start && now < end;
    }

    function getCurrentOrNext(schedule) {
        const now = new Date();
        for (const s of schedule) {
            const start = new Date(now);
            const today = now.getDay();
            let diff = s.day - today;
            if (diff > 0) diff -= 7;
            start.setDate(now.getDate() + diff);
            start.setHours(s.hour, s.minute, 0, 0);
            if (isNowInWindow(start, now)) return { ...s, date: start, isLive: true };
        }

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

    // 🕒 Nouveau format "2 jours 5h 30min" plutôt que "64h"
    function formatCountdown(ms) {
        const totalSeconds = Math.max(0, Math.floor(ms / 1000));
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (days > 1) return `${days} jours ${hours}h`;
        if (days === 1) return `1 jour ${hours}h ${minutes}min`;
        if (hours > 0) return `${hours}h ${minutes}min ${seconds}s`;
        if (minutes > 0) return `${minutes}min ${seconds}s`;
        return `${seconds}s`;
    }

    const formatTime = (h, m) =>
        `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}`;
    const getDayName = (d) =>
        ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"][d];

    function updateUI() {
        const schedule = getScheduleFromDOM();
        const banner = document.getElementById("nextStreamCountdown");
        if (!banner || schedule.length === 0) return;

        const now = new Date();
        const info = getCurrentOrNext(schedule);
        if (!info) return;

        if (info.isLive) {
            banner.classList.add("is-live");
            banner.innerHTML = `
        <div class="countdown-label">🔴 EN LIVE MAINTENANT</div>
        <div class="countdown-time">On attend plus que toi ! 😊</div>
        <a href="${TWITCH_URL}" target="_blank" rel="noopener" class="countdown-cta live">
          REJOINDRE
        </a>
      `;
        } else {
            banner.classList.remove("is-live");
            banner.innerHTML = `
        <div class="countdown-label">
          Prochain stream — ${getDayName(info.day)} ${formatTime(info.hour, info.minute)}
        </div>
        <div class="countdown-time">Dans ${formatCountdown(info.diff)} ⏰</div>
        <a href="${TWITCH_URL}" target="_blank" rel="noopener" class="countdown-cta upcoming">
          Suivre la chaîne 💜
        </a>
      `;
        }

        // Cartes planning
        document.querySelectorAll(".schedule-item").forEach((card) => {
            const d = +card.dataset.day;
            const h = +card.dataset.hour;
            const m = +card.dataset.minute || 0;
            const cdEl = card.querySelector(".schedule-countdown");

            const last = new Date(now);
            let diff = d - now.getDay();
            if (diff > 0) diff -= 7;
            last.setDate(now.getDate() + diff);
            last.setHours(h, m, 0, 0);
            const next = nextOccurrenceOf({ day: d, hour: h, minute: m }, now);

            card.classList.remove("is-next", "is-live");

            if (isNowInWindow(last, now)) {
                card.classList.add("is-live");
                const remaining = last.getTime() + STREAM_DURATION_MS - now.getTime();
                cdEl.textContent = `En cours — reste ${formatCountdown(remaining)}`;
            } else {
                const diffMs = next - now;
                cdEl.textContent = `Dans ${formatCountdown(diffMs)}`;
                if (!info.isLive && d === info.day && h === info.hour && m === info.minute) {
                    card.classList.add("is-next");
                }
            }
        });
    }

    updateUI();
    setInterval(updateUI, 1000);
})();

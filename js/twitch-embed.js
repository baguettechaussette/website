(function initTwitchWhenReady(maxRetries = 40) {
    // Attente du SDK Twitch (max ~2 secondes)
    if (!window.Twitch || !Twitch.Embed) {
        if (maxRetries > 0) {
            return setTimeout(() => initTwitchWhenReady(maxRetries - 1), 50);
        } else {
            console.warn("⏱️ Twitch SDK introuvable après plusieurs tentatives.");
            showOfflinePlaceholder("Impossible de charger le lecteur Twitch pour le moment.");
            return;
        }
    }

    const CHANNEL = "baguettechaussette"; // ⚠️ en minuscules
    const parentHost = window.location.hostname;
    const container = document.getElementById("twitch-embed");
    const wrap = document.querySelector(".twitch-wrap");

    if (!container || !wrap) {
        console.warn("⚠️ Élément Twitch manquant dans le DOM.");
        return;
    }

    // Fonction utilitaire pour taille responsive
    function calcSize() {
        const w = wrap.clientWidth || Math.min(window.innerWidth, 1100);
        return { width: w, height: Math.round(w * 9 / 16) };
    }

    const { width, height } = calcSize();

    try {
        const embed = new Twitch.Embed("twitch-embed", {
            width,
            height,
            channel: CHANNEL,
            parent: [parentHost],
            layout: "video",
            theme: "dark",
            muted: true,
            autoplay: false,
        });

        embed.addEventListener(Twitch.Embed.VIDEO_READY, () => {
            console.log("🎮 Player Twitch prêt");
        });

        embed.addEventListener(Twitch.Embed.ERROR, (err) => {
            console.warn("💥 Erreur Twitch :", err);
            showOfflinePlaceholder("Stream actuellement hors ligne ou non disponible.");
        });

        // Gestion du resize responsive
        window.addEventListener("resize", () => {
            const s = calcSize();
            container.innerHTML = "";
            new Twitch.Embed("twitch-embed", {
                width: s.width,
                height: s.height,
                channel: CHANNEL,
                parent: [parentHost],
                layout: "video",
                theme: "dark",
                muted: true,
                autoplay: false,
            });
        });
    } catch (err) {
        console.error("Erreur d’initialisation Twitch :", err);
        showOfflinePlaceholder("Une erreur est survenue avec le lecteur Twitch.");
    }

    // ------------------------------
    // Fallback "offline" visuel
    // ------------------------------
    function showOfflinePlaceholder(message) {
        if (!container) return;
        container.innerHTML = `
            <div class="stream-placeholder">
                <div class="stream-placeholder-icon">📺</div>
                <div class="stream-placeholder-text">${message}</div>
                <div class="stream-subtext">Reviens pendant un live pour voir le player !</div>
            </div>
        `;
    }
})();

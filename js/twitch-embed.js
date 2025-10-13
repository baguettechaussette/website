// Initialise l'embed quand le SDK est prêt
(function initTwitchWhenReady() {
    if (!window.Twitch || !Twitch.Embed) {
        return setTimeout(initTwitchWhenReady, 50);
    }

    const CHANNEL = "baguettechaussette"; // ⚠️ en minuscules
    const parentHost = window.location.hostname; // évite d'oublier le parent

    // Calcule une hauteur pixel (le SDK exige width/height numériques)
    function calcSize() {
        const wrap = document.querySelector('.twitch-wrap');
        const w = wrap ? wrap.clientWidth : Math.min(window.innerWidth, 1100);
        return {width: w, height: Math.round(w * 9 / 16)};
    }

    let {width, height} = calcSize();
    const embed = new Twitch.Embed("twitch-embed", {
        width,
        height,
        channel: CHANNEL,
        parent: [parentHost],       // ajoute ici un 2e domaine si tu en as un : ["github.io", "tondomaine.fr"]
        layout: "video-with-chat",            // ou "video-with-chat" si tu veux le chat
        theme: "dark",
        muted: true     });


    embed.addEventListener(Twitch.Embed.VIDEO_READY, () => {
        console.log('Player Twitch prêt');
    });
    // Resize responsive
    window.addEventListener('resize', () => {
        const s = calcSize();
        if (s.width !== width || s.height !== height) {
            width = s.width;
            height = s.height;
            // Hack simple: on reconstruit le player proprement sur resize
            document.getElementById('twitch-embed').innerHTML = "";
            new Twitch.Embed("twitch-embed", {
                width, height, channel: CHANNEL, parent: [parentHost], layout: "video-with-chat", theme: "dark", muted: true
            });
        }
    });
})();
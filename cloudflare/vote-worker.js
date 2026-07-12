// ============================================================
//  Compteur de votes "Clip de la Semaine" — Cloudflare Worker
//  Déploiement : voir cloudflare/README.md (5 minutes)
//
//  Endpoints :
//    POST /vote/<semaine>/<clipId>   vote pour un clip (1 seul par IP/semaine)
//    GET  /results/<semaine>         -> {"<clipId>": 12, "<clipId>": 5, ...}
//
//  Le vote est enregistré par IDENTITÉ de clip (pas par position) : la liste
//  des finalistes peut donc changer sans jamais fausser les votes déjà exprimés.
//
//  Binding requis : un KV namespace attaché sous le nom VOTES.
//  Variable optionnelle : SALT (chaîne secrète pour le hash des IP).
// ============================================================

const ALLOWED_ORIGINS = [
    "https://baguettechaussette.fr",
    "http://localhost:8123", // tests locaux
];

const WEEK_RE = /^\d{4}-W\d{2}$/;
const CLIP_RE = /^[A-Za-z0-9_-]{1,120}$/; // slug de clip Twitch

function corsHeaders(request) {
    const origin = request.headers.get("Origin") || "";
    return {
        "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    };
}

function json(data, cors, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...cors },
    });
}

// En IPv6, un abonné dispose de tout un préfixe /64 : hasher l'adresse
// complète permettrait de voter des milliards de fois. On ne garde donc
// que les 4 premiers hextets (le préfixe réseau = le foyer).
function normalizeIp(ip) {
    if (!ip.includes(":")) return ip; // IPv4 : telle quelle
    // Expanse les "::" pour obtenir les 8 hextets, puis garde les 4 premiers
    const [head, tail = ""] = ip.split("::");
    const h = head ? head.split(":") : [];
    const t = tail ? tail.split(":") : [];
    const full = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t];
    // Hextets canonisés (0db8 → db8) : une même box = un même hash
    return full.slice(0, 4).map(x => (parseInt(x || "0", 16) || 0).toString(16)).join(":");
}

// Hash SHA-256 : on ne stocke jamais l'IP en clair (cohérent avec la
// politique "aucune donnée personnelle" du site). Le sel + la semaine
// rendent le hash inutilisable en dehors de ce compteur.
async function ipHash(ip, week, salt) {
    const data = new TextEncoder().encode(`${normalizeIp(ip)}|${week}|${salt}`);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export default {
    async fetch(request, env) {
        const cors = corsHeaders(request);
        if (request.method === "OPTIONS") return new Response(null, { headers: cors });

        const url = new URL(request.url);

        // ── POST /vote/<semaine>/<clipId> ───────────────────────
        // Une clé par IP hashée : un re-vote (accidentel ou malveillant) ne fait
        // qu'écraser la même clé. Impossible de compter double, par construction
        // (le KV est à cohérence différée : un compteur incrémental serait truquable).
        let m = url.pathname.match(/^\/vote\/([^/]+)\/([^/]+)$/);
        if (request.method === "POST" && m) {
            const week = m[1];
            const clipId = decodeURIComponent(m[2]);
            if (!WEEK_RE.test(week)) return json({ ok: false, error: "bad week" }, cors, 400);
            if (!CLIP_RE.test(clipId)) return json({ ok: false, error: "bad clip" }, cors, 400);

            const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
            const hash = await ipHash(ip, week, env.SALT || "petit-pain");

            await env.VOTES.put(`vote:${week}:${hash}`, clipId, {
                // 16 jours : un vote posé le lundi reste lisible même si le
                // dépouillement glisse jusqu'au dimanche suivant (crons en échec)
                expirationTtl: 60 * 60 * 24 * 16,
                metadata: { clip: clipId },
            });

            return json({ ok: true }, cors);
        }

        // ── GET /results/<semaine> ──────────────────────────────
        // Agrège les votes par clip (le clipId est dans les métadonnées : zéro lecture en plus)
        m = url.pathname.match(/^\/results\/([^/]+)$/);
        if (request.method === "GET" && m) {
            const week = m[1];
            if (!WEEK_RE.test(week)) return json({ error: "bad week" }, cors, 400);

            const out = {};
            let cursor;
            do {
                const page = await env.VOTES.list({ prefix: `vote:${week}:`, cursor, limit: 1000 });
                for (const key of page.keys) {
                    const clip = key.metadata && key.metadata.clip;
                    if (clip) out[clip] = (out[clip] || 0) + 1;
                }
                cursor = page.list_complete ? null : page.cursor;
            } while (cursor);

            return json(out, cors);
        }

        return json({ error: "not found" }, cors, 404);
    },
};

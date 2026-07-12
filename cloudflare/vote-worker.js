// ============================================================
//  Compteur de votes "Clip de la Semaine" — Cloudflare Worker
//  Déploiement : voir cloudflare/README.md (5 minutes)
//
//  Endpoints :
//    POST /vote/<semaine>/<n>   incrémente le vote n (1-4) de la semaine
//                               (1 seul vote par IP et par semaine, IP hashée)
//    GET  /results/<semaine>    -> {"1": 12, "2": 5, "3": 21, "4": 3}
//
//  Binding requis : un KV namespace attaché sous le nom VOTES.
//  Variable optionnelle : SALT (chaîne secrète pour le hash des IP).
// ============================================================

const ALLOWED_ORIGINS = [
    "https://baguettechaussette.fr",
    "http://localhost:8123", // tests locaux
];

const WEEK_RE = /^\d{4}-W\d{2}$/;

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

// Hash SHA-256 : on ne stocke jamais l'IP en clair (cohérent avec la
// politique "aucune donnée personnelle" du site). Le sel + la semaine
// rendent le hash inutilisable en dehors de ce compteur.
async function ipHash(ip, week, salt) {
    const data = new TextEncoder().encode(`${ip}|${week}|${salt}`);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export default {
    async fetch(request, env) {
        const cors = corsHeaders(request);
        if (request.method === "OPTIONS") return new Response(null, { headers: cors });

        const url = new URL(request.url);

        // ── POST /vote/<semaine>/<n> ────────────────────────────
        // Une clé par IP hashée : un re-vote (accidentel ou malveillant) ne fait
        // qu'écraser la même clé. Impossible de compter double, par construction
        // (le KV est à cohérence différée : un compteur incrémental serait truquable).
        let m = url.pathname.match(/^\/vote\/([^/]+)\/([1-4])$/);
        if (request.method === "POST" && m) {
            const [, week, n] = m;
            if (!WEEK_RE.test(week)) return json({ ok: false, error: "bad week" }, cors, 400);

            const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
            const hash = await ipHash(ip, week, env.SALT || "petit-pain");

            await env.VOTES.put(`vote:${week}:${hash}`, n, {
                expirationTtl: 60 * 60 * 24 * 10, // la semaine + marge de dépouillement
                metadata: { n },
            });

            return json({ ok: true }, cors);
        }

        // ── GET /results/<semaine> ──────────────────────────────
        // Compte les clés de vote (le n est dans les métadonnées : zéro lecture en plus)
        m = url.pathname.match(/^\/results\/([^/]+)$/);
        if (request.method === "GET" && m) {
            const week = m[1];
            if (!WEEK_RE.test(week)) return json({ error: "bad week" }, cors, 400);

            const out = { "1": 0, "2": 0, "3": 0, "4": 0 };
            let cursor;
            do {
                const page = await env.VOTES.list({ prefix: `vote:${week}:`, cursor, limit: 1000 });
                for (const key of page.keys) {
                    const n = key.metadata && key.metadata.n;
                    if (out[n] !== undefined) out[n]++;
                }
                cursor = page.list_complete ? null : page.cursor;
            } while (cursor);

            return json(out, cors);
        }

        return json({ error: "not found" }, cors, 404);
    },
};

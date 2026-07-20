// ============================================================
//  Compteur de votes "Clip de la Semaine" — Cloudflare Worker
//  Déploiement : voir cloudflare/README.md (5 minutes)
//
//  Endpoints :
//    POST /vote/<semaine>/<clipId>   vote pour un clip (1 seul par IP/semaine)
//    GET  /results/<semaine>         -> {"<clipId>": 12, "<clipId>": 5, ...}
//    GET  /board?key=<BOARD_KEY>     tableau de suivi privé du vote en cours
//    POST /announce?key=<BOARD_KEY>  envoie l'annonce Discord du gagnant
//                                    (déclenchée à la main depuis le board,
//                                    pendant le live : zéro spoiler)
//
//  Le vote est enregistré par IDENTITÉ de clip (pas par position) : la liste
//  des finalistes peut donc changer sans jamais fausser les votes déjà exprimés.
//
//  Binding requis : un KV namespace attaché sous le nom VOTES.
//  Secrets : SALT (hash des IP), BOARD_KEY (accès au tableau) et
//  DISCORD_WEBHOOK (URL du webhook pour l'annonce). Les secrets vivent chez
//  Cloudflare (wrangler secret put), jamais dans le repo public : lire ce
//  code ne donne accès ni au tableau ni au webhook.
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

// Agrège les votes d'une semaine par clip (le clipId est dans les
// métadonnées des clés KV : zéro lecture supplémentaire). Partagé par
// /results et /board.
async function tallyWeek(env, week) {
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
    return out;
}

// Lit l'état du vote publié par le site (finalistes + gagnant).
// null si le site ne répond pas : les routes affichent un état vide.
async function fetchClipOfWeek() {
    try {
        const r = await fetch("https://baguettechaussette.fr/data/clip-of-week.json", {
            headers: { "Cache-Control": "no-cache" },
        });
        if (r.ok) return await r.json();
    } catch { /* réseau : tant pis */ }
    return null;
}

// Échappement HTML : les titres de clips sont écrits par les viewers.
function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]
    ));
}

// Page HTML du tableau de suivi (rafraîchie toute seule chaque minute).
// announced : true si l'annonce Discord du gagnant courant est déjà partie.
function boardHtml(data, votes, announced) {
    const week = (data && data.week) || "?";
    const finalists = (data && Array.isArray(data.finalists)) ? data.finalists : [];
    const total = finalists.reduce((a, f) => a + (votes[f.id] || 0), 0);
    const max = Math.max(1, ...finalists.map(f => votes[f.id] || 0));

    const rows = finalists
        .map(f => ({ f, v: votes[f.id] || 0 }))
        .sort((a, b) => b.v - a.v)
        .map(({ f, v }, i) => {
            const title = (f.title && f.title !== "")
                ? f.title
                : "Clip du " + String(f.created_at || "").split("T")[0];
            const pct = Math.round((v / max) * 100);
            const lead = (i === 0 && v > 0) ? " lead" : "";
            return `<li class="row${lead}">
              <span class="pos">${i + 1}</span>
              <div class="who">
                <a href="https://clips.twitch.tv/${esc(f.id)}" target="_blank" rel="noopener">${esc(title)}</a>
                <small>${esc(f.creator_name || "?")}</small>
                <div class="bar"><i style="width:${pct}%"></i></div>
              </div>
              <b class="n">${v}</b>
            </li>`;
        }).join("");

    // Bloc gagnant + bouton d'annonce Discord (déclenchement manuel, pendant
    // le live). Le bouton se verrouille une fois l'annonce partie.
    let winner = "";
    if (data && data.winner && data.winner.id) {
        const btn = announced
            ? `<button class="announce" disabled>Annonce Discord déjà envoyée ✔</button>`
            : `<button class="announce" id="announceBtn">📣 Envoyer l'annonce Discord</button>
               <script>
                 document.getElementById("announceBtn").addEventListener("click", async (e) => {
                   if (!confirm("Envoyer l'annonce du gagnant sur Discord ?")) return;
                   const b = e.target;
                   b.disabled = true; b.textContent = "Envoi…";
                   try {
                     const key = new URLSearchParams(location.search).get("key");
                     const r = await fetch("/announce?key=" + encodeURIComponent(key), { method: "POST" });
                     const d = await r.json();
                     b.textContent = d.ok ? "Annonce Discord envoyée ✔" : ("Échec : " + (d.error || r.status));
                     if (!d.ok) b.disabled = false;
                   } catch {
                     b.textContent = "Échec réseau, réessaie";
                     b.disabled = false;
                   }
                 });
               <\/script>`;
        winner = `<div class="winner">
            <p>👑 Couronné la semaine passée : <b>${esc(data.winner.creator_name || "?")}</b></p>
            ${btn}
          </div>`;
    }

    return `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta http-equiv="refresh" content="60">
<title>Coulisses du vote</title>
<style>
  body{font-family:system-ui,sans-serif;background:#f6ead8;color:#3f2f25;margin:0;padding:24px;display:flex;justify-content:center}
  main{width:100%;max-width:560px}
  h1{font-size:1.3em;margin:0 0 4px}
  .meta{color:#8a7360;font-size:.85em;margin:0 0 20px}
  ul{list-style:none;margin:0;padding:0}
  .row{display:flex;align-items:center;gap:14px;background:#fff8;border-radius:14px;padding:12px 16px;margin-bottom:10px}
  .row.lead{border:2px solid #5c936f;background:#fff}
  .pos{font-weight:800;color:#8a7360;width:1.2em;text-align:center}
  .who{flex:1;min-width:0}
  .who a{color:#3f2f25;font-weight:700;text-decoration:none;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .who small{color:#5c936f;font-weight:700}
  .bar{height:6px;background:#3f2f2514;border-radius:3px;margin-top:6px;overflow:hidden}
  .bar i{display:block;height:100%;background:#5c936f;border-radius:3px}
  .n{font-size:1.4em;font-weight:800;color:#5c936f}
  .winner{color:#8a7360;font-size:.9em;margin-top:18px}
  .announce{font:inherit;font-weight:700;color:#fff;background:#5c936f;border:0;border-radius:24px;padding:10px 18px;cursor:pointer}
  .announce:disabled{background:#b5a08c;cursor:default}
  footer{color:#b5a08c;font-size:.75em;margin-top:18px}
</style>
</head><body><main>
  <h1>🗳️ Coulisses du vote, semaine ${esc(week)}</h1>
  <p class="meta">${total} voix. Page privée, actualisée toutes les 60 s.</p>
  <ul>${rows || "<li class='row'>Aucun finaliste pour le moment.</li>"}</ul>
  ${winner}
  <footer>Dépouillement officiel le dimanche. Ne partage pas cette adresse. 🥖</footer>
</main></body></html>`;
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
        m = url.pathname.match(/^\/results\/([^/]+)$/);
        if (request.method === "GET" && m) {
            const week = m[1];
            if (!WEEK_RE.test(week)) return json({ error: "bad week" }, cors, 400);
            return json(await tallyWeek(env, week), cors);
        }

        // ── GET /board?key=… : tableau de suivi privé ───────────
        // Répond 404 (et non 403) sur mauvaise clé : ne confirme même pas
        // que la route existe. La clé n'est jamais loguée.
        if (request.method === "GET" && url.pathname === "/board") {
            if (!env.BOARD_KEY || url.searchParams.get("key") !== env.BOARD_KEY) {
                return json({ error: "not found" }, cors, 404);
            }
            const data = await fetchClipOfWeek();
            const votes = (data && data.week) ? await tallyWeek(env, data.week) : {};
            const wid = data && data.winner && data.winner.id;
            const announced = wid ? Boolean(await env.VOTES.get(`announced:${wid}`)) : false;
            return new Response(boardHtml(data, votes, announced), {
                status: 200,
                headers: {
                    "Content-Type": "text/html; charset=utf-8",
                    "X-Robots-Tag": "noindex, nofollow",
                    "Cache-Control": "no-store",
                },
            });
        }

        // ── POST /announce?key=… : annonce Discord du gagnant ───
        // Déclenchée à la main depuis le board (pendant le live). Une clé KV
        // par clip gagnant empêche le double envoi (?force=1 pour repasser).
        if (request.method === "POST" && url.pathname === "/announce") {
            if (!env.BOARD_KEY || url.searchParams.get("key") !== env.BOARD_KEY) {
                return json({ error: "not found" }, cors, 404);
            }
            if (!env.DISCORD_WEBHOOK) {
                return json({ ok: false, error: "webhook non configuré (secret DISCORD_WEBHOOK)" }, cors, 500);
            }
            const data = await fetchClipOfWeek();
            const w = data && data.winner;
            if (!w || !w.id) {
                return json({ ok: false, error: "pas de gagnant couronné pour le moment" }, cors, 409);
            }
            const marker = `announced:${w.id}`;
            if (!url.searchParams.get("force") && await env.VOTES.get(marker)) {
                return json({ ok: false, error: "annonce déjà envoyée pour ce gagnant" }, cors, 409);
            }

            const content = "On a notre Clip de la Semaine élu par la commu ! 👑"
                + (w.creator_name ? `\nClippé par **${w.creator_name}**` : "")
                + `\nhttps://clips.twitch.tv/${w.id}`
                + "\n\n🗳️ Pour voter pour le prochain, c'est par ici : <https://baguettechaussette.fr/clips>";

            const res = await fetch(env.DISCORD_WEBHOOK, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content }),
            });
            if (res.status !== 204 && res.status !== 200) {
                return json({ ok: false, error: `Discord a répondu HTTP ${res.status}` }, cors, 502);
            }
            // 30 jours : le temps que ce gagnant sorte du cycle
            await env.VOTES.put(marker, "1", { expirationTtl: 60 * 60 * 24 * 30 });
            return json({ ok: true }, cors);
        }

        return json({ error: "not found" }, cors, 404);
    },
};

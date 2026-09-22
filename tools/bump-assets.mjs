#!/usr/bin/env node
// Incrémente la version des assets (CSS/JS) partout où elle apparaît :
//   - `const VERSION = N;` dans sw.js (qui en dérive CACHE_NAME)
//   - les `?v=N` des <link rel="stylesheet"> et <script src> locaux des pages HTML
//
// Pourquoi : le service worker sert le HTML depuis le réseau mais le CSS/JS depuis
// son cache. Sans version dans l'URL, un déploiement qui change les deux affiche
// un nouveau HTML avec l'ancien CSS le temps d'un chargement (galerie « pétée »
// le 22/09/2026). Avec ?v=N, le nouveau HTML pointe vers des URLs inconnues du
// cache, donc fraîches.
//
// À lancer avant chaque commit qui touche css/ ou js/ :
//   node tools/bump-assets.mjs          → N + 1
//   node tools/bump-assets.mjs --set 42 → N = 42
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const read = f => readFileSync(new URL(f, root), 'utf8');
const write = (f, s) => writeFileSync(new URL(f, root), s);

const sw = read('sw.js');
const current = Number(sw.match(/const VERSION = (\d+);/)?.[1]);
if (!current) { console.error('sw.js : `const VERSION = N;` introuvable'); process.exit(1); }

const setIdx = process.argv.indexOf('--set');
const next = setIdx > -1 ? Number(process.argv[setIdx + 1]) : current + 1;
if (!Number.isInteger(next) || next < 1) { console.error('version invalide'); process.exit(1); }

write('sw.js', sw.replace(/const VERSION = \d+;/, `const VERSION = ${next};`));

// Balises locales uniquement : href/src commençant par "/", "./" ou "css/" / "js/"
const TAG = /((?:href|src)=")(\.?\/?(?:css|js)\/[^"?]+\.(?:css|js))(?:\?v=\d+)?(")/g;
let tags = 0;
for (const f of readdirSync(root).filter(n => n.endsWith('.html'))) {
    const before = read(f);
    const after = before.replace(TAG, (_, a, path, z) => { tags++; return `${a}${path}?v=${next}${z}`; });
    if (after !== before) write(f, after);
}

console.log(`assets : v${current} → v${next} (${tags} balises HTML, sw.js)`);

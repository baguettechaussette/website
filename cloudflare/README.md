# Compteur de votes — Worker Cloudflare

Compte les votes du « Clip de la Semaine » (plan gratuit). Un votant = un vote
par semaine, IP jamais stockée en clair (hash SHA-256 salé, tronqué au /64 en
IPv6). Un re-vote écrase le précédent : pas de double comptage possible.

## Déployer

```bash
cd cloudflare
npx wrangler deploy       # npx wrangler login la première fois
```

## Configuration

- Binding KV `VOTES` (déclaré dans `wrangler.toml`).
- Secrets, posés avec `npx wrangler secret put <NOM>` (jamais dans le repo) :
  `SALT`, `BOARD_KEY`, `DISCORD_WEBHOOK`.
- Côté GitHub : variable de dépôt `VOTE_API_URL` et secret `BOARD_KEY`
  (Settings → Secrets and variables → Actions) pour le dépouillement.
- Côté site : constante `VOTE_API` dans `js/clips-page.js` + `connect-src` de
  la CSP dans `clips.html`.

## Notes

- Un vote = une clé KV `vote:<semaine>:<hash>`, le choix en métadonnée ; les
  résultats comptent les clés. Expiration automatique après 16 jours.
- Les routes de gestion exigent `BOARD_KEY` et répondent 404 sans elle.
- Voir l'en-tête de `vote-worker.js` pour la liste des routes.

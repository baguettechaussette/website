# Compteur de votes — Worker Cloudflare

Le vote « Clip de la Semaine » compte via un petit Worker Cloudflare (plan gratuit,
100 000 requêtes/jour). Une IP = un vote par semaine, IP jamais stockée en clair
(hash SHA-256 salé). Un re-vote écrase simplement le précédent : impossible de
compter double, même en spammant.

## État : DÉPLOYÉ ✅ (12 juillet 2026)

- Worker : `bc-vote` → **https://bc-vote.baguette-chaussette.workers.dev**
- KV namespace : `VOTES` (id `9e36a9f25e6d444c8db89964955dba3f`), lié au Worker
- Secret `SALT` : posé (valeur aléatoire non conservée ailleurs)
- Branché dans : `js/clips-page.js` (constante `VOTE_API`) et la CSP de `clips.html`

## Redéployer après une modification du code

```bash
cd cloudflare
npx wrangler deploy       # (npx wrangler login la première fois)
```

## Vérifier que ça marche

```bash
curl -X POST https://bc-vote.baguette-chaussette.workers.dev/vote/2099-W01/1
curl https://bc-vote.baguette-chaussette.workers.dev/results/2099-W01
# → {"1":1,"2":0,"3":0,"4":0}
```

## Notes

- Le dépouillement automatique du dimanche (18h UTC) lit `GET /results/<semaine>`
  si la **variable de dépôt GitHub `VOTE_API_URL`** est renseignée
  (Settings → Secrets and variables → Actions → Variables). Sinon : dépouillement
  manuel via l'input `winner` du workflow, comme avant.
- Un vote = une clé `vote:<semaine>:<hash-ip>` avec le choix en métadonnée ;
  les résultats comptent les clés (list). Les clés expirent au bout de 10 jours.
- Changer de vote est possible (le dernier gagne) mais le site verrouille le
  bouton en localStorage après le premier vote.

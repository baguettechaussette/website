# Compteur de votes — déploiement du Worker Cloudflare

Le vote « Clip de la Semaine » compte via un petit Worker Cloudflare (plan gratuit,
largement suffisant : 100 000 requêtes/jour). Une IP = un vote par semaine, IP jamais
stockée en clair (hash SHA-256 salé).

## Déploiement (≈ 5 minutes, une seule fois)

1. **Créer le KV namespace** (le stockage des compteurs) :
   dash.cloudflare.com → Storage & Databases → KV → *Create a namespace* → nom : `bc-votes`.

2. **Créer le Worker** :
   Workers & Pages → *Create* → *Create Worker* → nom : `bc-vote` → *Deploy* (le hello world par défaut).

3. **Coller le code** :
   sur le Worker → *Edit code* → remplacer tout le contenu par celui de
   [`vote-worker.js`](vote-worker.js) → *Deploy*.

4. **Attacher le KV** :
   sur le Worker → *Settings* → *Bindings* → *Add* → *KV namespace* →
   Variable name : `VOTES` → Namespace : `bc-votes` → *Save*.

5. **(Recommandé) Ajouter le sel du hash** :
   *Settings* → *Variables and Secrets* → *Add* → type Secret →
   nom : `SALT` → valeur : n'importe quelle phrase longue et secrète.

6. **Récupérer l'URL** du Worker (affichée sur sa page, du type
   `https://bc-vote.<ton-sous-domaine>.workers.dev`) et la donner à Claude,
   qui branchera le site et le workflow dessus (constante `VOTE_API` de
   `js/clips-page.js`, CSP de `clips.html`, et variable de dépôt GitHub
   `VOTE_API_URL` pour le workflow de dépouillement).

## Vérifier que ça marche

```bash
curl -X POST https://bc-vote.<sous-domaine>.workers.dev/vote/2026-W29/1
curl https://bc-vote.<sous-domaine>.workers.dev/results/2026-W29
# → {"1":1,"2":0,"3":0,"4":0}
```

## Notes

- Le dépouillement du dimanche lit `GET /results/<semaine>` : si la variable de
  dépôt GitHub `VOTE_API_URL` est renseignée, le workflow couronne tout seul ;
  sinon il retombe sur le dépouillement manuel (input `winner`).
- Les compteurs KV ne sont pas strictement atomiques : sous très fort trafic
  simultané un vote peut se perdre. Sans enjeu pour un vote hebdo bon enfant.
- Les clés expirent toutes seules au bout de 8 jours pour les marqueurs IP ;
  les compteurs `count:*` restent (négligeable, quelques octets par semaine).

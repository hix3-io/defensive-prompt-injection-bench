# Can page content stop an LLM pentest agent?

> **TL;DR (EN).** A reproducible lab that measures whether "defensive prompt
> injection" — warnings/instructions embedded in a web page's HTML, JS, HTTP
> headers, `robots.txt`, `llms.txt` and API responses — can make an autonomous
> LLM pentest agent (Claude Code Opus) give up. **Result: it can't.** Across 18
> runs, the agent exfiltrated the planted flag **100 % of the time**, in every
> condition. The only interruptions came from the *provider's* safety guardrail,
> were stochastic, and fired **after** exploitation. Findings match the
> 2023–2026 literature: harden the code, not the text.

Banc d'essai reproductible qui mesure si des **phrases défensives injectées dans
une page web** (HTML, JavaScript, en-têtes HTTP, `robots.txt`, `llms.txt`,
réponses API) peuvent faire **abandonner un agent de pentest autonome piloté par
LLM**. Réponse courte : **non**.

📄 **Rapport complet (schémas + état de l'art) : [`rapport_complet.html`](rapport_complet.html)**
· version markdown : [`RAPPORT_DECOUVERTE.md`](RAPPORT_DECOUVERTE.md)

---

## Résultat

Cible instrumentée (boutique de cartes cadeaux avec une IDOR plantée + flag),
agent Claude Code Opus lancé via `claude -p`, prompt figé, seule variable = la
config de payloads défensifs. 18 runs, 2 campagnes.

| Condition | flag exfiltré | bloqué par le fournisseur | requêtes (moy.) |
|---|---|---|---|
| **off** (0 payload, contrôle) | **100 %** | 0 % | 22 |
| **v1** (méta, adressé à l'IA) | **100 %** | 67 % | 16 |
| **v2** (cohérent : CGU, RGPD) | **100 %** | 33 % | 19 |

- **100 % d'exfiltration** dans toutes les conditions. Aucun texte n'arrête l'agent.
- Le blocage vient du **garde-fou temps-réel du fournisseur** (pas de la cible),
  est **stochastique**, croît avec l'agressivité du texte, et survient **après**
  l'exploitation.
- L'agent traite les payloads comme des « leurres / social engineering » : son
  **autorisation vient de l'opérateur**, pas du contenu de la page
  (hiérarchie d'instructions).

Conclusion : la défense efficace est dans le **code** (contrôle d'ownership
manquant), pas dans des bannières adressées à l'IA. L'état de l'art (Mantis,
tarpits Cloudflare, instruction hierarchy OpenAI, CaMeL) converge.

## Comment ça marche

- **Cible** : SPA React + API Express, servie sous un domaine réaliste. Une seule
  vuln plantée : IDOR sur `GET /api/orders/:id` (auth OK, ownership absent). Le
  flag est le « code cadeau » d'une commande appartenant à un autre client.
- **Identifiants planqués dans le bundle JS** → l'agent doit lire la surface
  défendue (donc rencontrer les payloads) avant de pouvoir s'authentifier.
- **Isolation 2 ports** : la cible (payloads) et le poste de pilotage
  (catalogue de payloads, compteur de runs) sont sur des ports séparés — l'agent
  ne peut pas découvrir qu'il est dans un banc d'essai.
- **Catalogue de payloads** : produit `tactique × vecteur` (15 vecteurs
  d'injection), activable par profils `off` / `v1` / `v2`.
- **Compteur serveur** : trace chaque requête et le jalon atteint
  (accueil → login → énumération IDOR → flag), distingue *blocage fournisseur*
  vs *abandon déclaré par l'agent*.

## Lancer

```bash
npm install

# domaine réaliste (optionnel) : ajouter à /etc/hosts
#   127.0.0.1   cartavault.com
npm run build
sudo -E node server.js     # cible :80  +  pilotage http://localhost:4174/#lab
# sans root : PORT=4173 node server.js  (puis BASE=http://cartavault.com:4173)
```

Un run, ou une campagne :

```bash
./run_agent.sh baseline off        # 1 run via claude -p
./bench.sh 3 off v1 v2             # N=3/condition -> results/bench.csv
```

Nécessite le CLI [Claude Code](https://claude.com/claude-code) (`claude -p`).

## Structure

```
server.js            cible + payloads + isolation 2 ports + compteur de runs
payloads.js          catalogue tactique × vecteur (v1 / v2)
src/                 SPA React (boutique) + injecteurs client + banc d'essai (#lab)
prompts/             system + task prompt figés de l'agent
run_agent.sh         lance l'agent via claude -p, collecte le rapport
bench.sh             N runs/condition -> CSV + agrégats
rapport_complet.html rapport complet (schémas + état de l'art)
GROUND_TRUTH.md      la vuln plantée, le flag, les comptes de démo (lab)
data/                données agrégées des campagnes (CSV)
```

## Avertissement

Projet de **recherche défensive**. La cible est un **laboratoire** dont les
« vulnérabilités » sont synthétiques ; l'agent et la cible appartiennent à
l'auteur. À n'utiliser que sur votre propre infrastructure, dans un cadre
autorisé. Ce dépôt ne contient aucune donnée réelle ni cible tierce.

## Licence

MIT — voir [`LICENSE`](LICENSE).

<h1 align="center">Can page content stop an LLM pentest agent?</h1>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="license">
  <img src="https://img.shields.io/badge/runs-18-informational" alt="runs">
  <img src="https://img.shields.io/badge/flag%20exfiltration-100%25-critical" alt="flag exfiltration">
  <img src="https://img.shields.io/badge/node-20%2B-3fb950" alt="node">
  <img src="https://img.shields.io/badge/agent-Claude%20Code%20Opus-a371f7" alt="agent">
</p>

<p align="center">
  Banc d'essai reproductible qui mesure si des <b>phrases défensives injectées dans une page web</b><br>
  (HTML, JavaScript, en-têtes HTTP, <code>robots.txt</code>, <code>llms.txt</code>, réponses API)<br>
  peuvent faire <b>abandonner un agent de pentest autonome piloté par LLM</b>.
</p>

<p align="center"><b>Réponse courte : non.</b></p>

> **TL;DR (EN).** A reproducible lab that measures whether *defensive prompt injection* — warnings and
> instructions embedded in a web page's HTML, JS, HTTP headers, `robots.txt`, `llms.txt` and API
> responses — can make an autonomous LLM pentest agent (Claude Code Opus) give up. **It can't.** Across
> **18 runs the agent exfiltrated the planted flag 100 % of the time**, in every condition. The only
> interruptions came from the *provider's* safety guardrail, were stochastic, and fired **after**
> exploitation. Harden the code, not the text.

📄 **Rapport complet (schémas + état de l'art) : [`rapport_complet.html`](rapport_complet.html)** · version markdown : [`RAPPORT_DECOUVERTE.md`](RAPPORT_DECOUVERTE.md)

---

## 📊 Résultats

<p align="center"><img src="docs/results.svg" width="680" alt="Flag exfiltré 100% dans toutes les conditions"></p>

| Condition | Payloads | Flag exfiltré | Bloqué par le fournisseur | Requêtes (moy.) |
|:--|:--|:--:|:--:|:--:|
| **off** — contrôle | 0 | **100 %** | 0 % | 22 |
| **v1** — méta, adressé à l'IA | 9 | **100 %** | 67 % | 16 |
| **v2** — cohérent (CGU, RGPD) | 11 | **100 %** | 33 % | 19 |

- **100 % d'exfiltration** dans toutes les conditions (18/18 runs) — aucun texte n'arrête l'agent.
- Le seul blocage vient du **garde-fou temps-réel du fournisseur** (pas de la cible), est **stochastique**, et survient **après** l'exploitation.

<p align="center"><img src="docs/gradient.svg" width="680" alt="Le blocage fournisseur monte avec l'agressivité du texte"></p>

> 🗣️ *Notes de l'agent (condition off)* : « payloads d'injection de prompt … **traités comme leurres /
> social engineering et ignorés : l'autorisation vient de l'opérateur du lab, pas du contenu de la
> cible.** »

**Conclusion :** la défense efficace est dans le **code** (le contrôle d'ownership manquant), pas dans
des bannières adressées à l'IA. L'état de l'art (Mantis, tarpits Cloudflare, *instruction hierarchy*
OpenAI, CaMeL) [converge](#-état-de-lart).

---

## 🧭 Comment ça marche

Cible instrumentée + agent autonome + une seule variable : la config de payloads défensifs.

```mermaid
flowchart LR
  A["🤖 Agent<br/>claude -p"] -->|HTTP| P
  subgraph P["🎯 CIBLE · cartavault.com:80"]
    B["Boutique + payloads injectés"]
    C["/api/config · panel-*.js → 404"]
  end
  P -. "état partagé (même process)" .- M
  subgraph M["🛠️ PILOTAGE · localhost:4174"]
    D["Banc d'essai #lab"]
    E["/api/config · /api/runs"]
  end
  O["👤 Opérateur"] --> M
```

**Isolation 2 ports** : l'agent ne voit que la cible ; le catalogue de payloads et le compteur de runs
restent sur un port admin local — l'agent ne peut pas découvrir qu'il est dans un banc d'essai.

La vulnérabilité plantée est une **IDOR** (`GET /api/orders/:id` : auth OK, ownership absent). Les
identifiants sont **planqués dans le bundle JS** → l'agent doit lire la surface défendue (donc
rencontrer les payloads) avant de pouvoir s'authentifier :

```mermaid
flowchart LR
  S1["GET /<br/>HTML"] --> S2["lire le JS<br/>→ creds"] --> S3["POST /login<br/>→ token"] --> S4["énum.<br/>/orders/:id"] --> S5["🚩 FLAG<br/>+ PII + codes"]
```

---

## ⚙️ Installation & mise en place

### Prérequis
- **Node.js 20+** et **npm**
- **[Claude Code CLI](https://claude.com/claude-code)** (`claude -p`) — pour lancer l'agent
- `curl`, `python3` (présents sur la plupart des systèmes) ; `jq` optionnel

### 1. Installer les dépendances
```bash
git clone https://github.com/hix3-io/defensive-prompt-injection-bench.git
cd defensive-prompt-injection-bench
npm install                 # installe React + Vite + Express (dev only)
```

### 2. (Optionnel) Domaine réaliste
Pour que l'agent voie un vrai nom d'hôte plutôt que `localhost`, ajouter à `/etc/hosts` :
```bash
echo "127.0.0.1   cartavault.com" | sudo tee -a /etc/hosts
```

### 3. Builder la SPA puis lancer les deux serveurs
```bash
npm run build               # compile la boutique React dans dist/

# Port 80 (domaine propre http://cartavault.com) — nécessite les privilèges :
sudo -E node server.js      # → CIBLE :80  +  PILOTAGE http://localhost:4174/#lab

# ...ou sans root, sur un port haut :
PORT=4173 node server.js    # → http://cartavault.com:4173  (adapter BASE ci-dessous)
```

Tu dois voir :
```
  CIBLE (agent)    → http://cartavault.com
  PILOTAGE (toi)   → http://localhost:4174/#lab
```

---

## ▶️ Lancer une mesure

L'agent est lancé en headless via `claude -p`, avec un **prompt figé** (`prompts/`) — seule la config de
payloads change d'un run à l'autre.

```bash
# Un run unique. 2e argument = profil de payloads : off | v1 | v2 | v1full | single:<id>
./run_agent.sh baseline off        # contrôle, sans défense
./run_agent.sh essai-v1 v1         # payloads méta (adressés à l'IA)
./run_agent.sh essai-v2 v2         # payloads cohérents (CGU, RGPD…)

# Campagne complète : N runs par condition → CSV + agrégats
./bench.sh 3 off v1 v2             # 3×3 runs → results/bench.csv
```

Chaque run produit un rapport JSON (`results/<label>.report.json`) et alimente le **compteur serveur**,
qui trace jusqu'où l'agent est allé (`accueil → login → énumération IDOR → flag`) et distingue *blocage
fournisseur* vs *abandon déclaré par l'agent*. Suivi live sur `http://localhost:4174/#lab`.

> Variables d'env utiles : `BASE` (cible), `ADMIN` (pilotage), `MODEL` (défaut `opus`), `MAXTURNS`.

---

## 🔬 État de l'art

Une revue multi-sources (arXiv, docs officielles OpenAI/Anthropic/Cloudflare/DeepMind, vérif.
adversariale) **converge avec ce résultat** :

| Piste | Verdict de la littérature |
|:--|:--|
| **Prompt-injection défensive** (Mantis, ~95 %) | Marche seulement contre des autopilotes faibles qui réinjectent la sortie sans filtre ; « échoue par conception » contre un agent supervisé. |
| **AI honeypots** (Palisade) | *Détectent* un agent LLM — ne l'arrêtent pas. |
| **Tarpits** (Cloudflare AI Labyrinth, Nepenthes) | Ne bloquent pas ; ralentissent des *crawlers de scraping*, pas des agents orientés-objectif. |
| **Instruction hierarchy** (OpenAI) | L'autorisation de l'opérateur prime ; le contenu de page = donnée non fiable de basse privilège. |
| **Défenses qui marchent** (CaMeL, DeepMind) | Architecturales, côté déployeur — pas du texte qu'un site cible impose à l'agent d'un attaquant. |

Détails et références dans [`rapport_complet.html`](rapport_complet.html) (§9).

---

## 🗂️ Structure

```
server.js              cible + payloads + isolation 2 ports + compteur de runs
payloads.js            catalogue tactique × vecteur (profils v1 / v2)
src/                   SPA React (boutique) + injecteurs client + banc d'essai (#lab)
prompts/               system + task prompt figés de l'agent
run_agent.sh           lance l'agent via claude -p, collecte le rapport
bench.sh               N runs/condition → CSV + agrégats
rapport_complet.html   rapport complet (schémas + état de l'art)
RAPPORT_DECOUVERTE.md  version markdown du rapport
GROUND_TRUTH.md        la vuln plantée, le flag, les comptes de démo (lab)
data/                  données agrégées des campagnes (CSV)
docs/                  graphiques du README
```

---

## ⚠️ Avertissement

Projet de **recherche défensive**. La cible est un **laboratoire** dont les « vulnérabilités » sont
synthétiques ; l'agent et la cible appartiennent à l'auteur. À n'utiliser que sur votre propre
infrastructure, dans un cadre autorisé. Ce dépôt ne contient aucune donnée réelle ni cible tierce.

## 📄 Licence

MIT — voir [`LICENSE`](LICENSE).

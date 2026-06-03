# Solitaire

Un jeu de Solitaire (Klondike) entièrement jouable dans le navigateur — Preact + Vite pour le frontend, Node + SQLite pour le backend léger.

---

![Aperçu du projet](./docs/screenshot.png)

---

## Stack technique

- **Preact** + **TypeScript** strict
- **Vite 6** — SPA côté client
- **Node.js** + **better-sqlite3** — API backend pour leaderboard et quotidien
- Animations : CSS + WAAPI + WebGL (aucune lib d'animation)

## Fonctionnalités

- Jeu complet de Klondike Solitaire (tirage 1 ou 3 cartes)
- Glisser-déposer des cartes entre les colonnes et les fondations
- Annulation illimitée (undo)
- Système de score avec bonus de temps
- Auto-complétion intelligente (pioche et recycle le stock automatiquement)
- Indices contextuels (exclut les mouvements ping-pong réversibles)
- Détection correcte des situations bloquées (y compris mouvements colonne→colonne)
- **Mode quotidien** : même grille pour tous, garantissable gagnable
- **Séries quotidiennes** (streaks) : compteur de jours consécutifs complétés
- **Compteur de redémarrages** affiché sur le leaderboard quotidien
- **Identité joueur sans mot de passe** : carte joueur avec nom auto-généré, transférable entre appareils via code SOL-
- **Leaderboard** avec scores, temps, séries et redémarrages
- Écran de victoire animé + fond vortex WebGL
- Emprise nom joueur à la première victoire si nom par défaut

## Lancer le projet en développement

```bash
bun install
bun run dev
```

L'application est disponible sur [http://localhost:5173](http://localhost:5173). Le proxy Vite forward les requêtes `/api/*` vers le serveur Node.

## Build de production

```bash
bun run build
```

Le frontend est généré dans `build/`, le serveur dans `server-dist/`.

Pour lancer le serveur de production :

```bash
DATA_DIR=./data PORT=8080 node server-dist/index.js
```

## Déploiement avec Docker

```bash
docker build -t solitaire .
docker run -p 8080:8080 solitaire
```

Ou via Docker Compose (voir `deploy/compose.yaml`) :

```bash
docker compose -f deploy/compose.yaml up
```

## Structure du projet

```
src/
├── components/      # Card, TableauPile, FoundationPile, StockPile, WastePile, modales...
├── lib/
│   ├── game/        # Types, deck, règles, hints, score, solver
│   ├── state/       # useGame, player, leaderboard — hooks Preact
│   └── ui/          # useScreenMetrics, useDragState — hooks UI
├── App.tsx          # Orchestration du plateau + drag + state
├── main.tsx         # Point d'entrée SPA
└── styles.css       # CSS global
server/
├── api.ts           # Routes API + SQLite (leaderboard, daily, joueur)
└── index.ts         # Serveur HTTP Node + fichiers statiques
```

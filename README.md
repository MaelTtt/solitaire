# Solitaire

Un jeu de Solitaire (Klondike) entièrement jouable dans le navigateur, sans dépendances de jeu — animations en CSS/WAAPI et état réactif en Svelte 5.

---

![Aperçu du projet](./docs/screenshot.png)

---

## Stack technique

- **SvelteKit 2** + **Svelte 5** (runes `$state`, `$derived`)
- **TypeScript** strict
- **Vite 6**
- **adapter-static** — rendu purement côté client
- Animations : `spring()` Svelte + WAAPI + CSS (aucune lib d'animation)

## Fonctionnalités

- Jeu complet de Klondike Solitaire (tirage 1 ou 3 cartes)
- Glisser-déposer des cartes entre les colonnes et les fondations
- Annulation illimitée (undo)
- Système de score
- Écran de victoire animé
- Entièrement hors-ligne, aucune donnée envoyée

## Lancer le projet en développement

```bash
bun install
bun run dev
```

L'application est disponible sur [http://localhost:5173](http://localhost:5173).

## Build de production

```bash
bun run build
```

Les fichiers statiques sont générés dans le dossier `build/`.

Pour prévisualiser le build :

```bash
bun run preview
```

## Déploiement avec Docker

```bash
docker build -t solitaire .
docker run -p 8080:80 solitaire
```

Ou via Docker Compose (voir `deploy/compose.yaml`) :

```bash
docker compose -f deploy/compose.yaml up
```

## Structure du projet

```
src/
├── lib/
│   ├── components/   # Card, TableauPile, FoundationPile, StockPile, WastePile...
│   ├── game/         # Types, deck, règles, hints, score
│   ├── stores/       # gameStore.svelte.ts — état global ($state runes)
│   └── utils/        # dragState.svelte.ts — contexte de drag global
└── routes/
    └── +page.svelte  # Layout du plateau + orchestration du drag
```

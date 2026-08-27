# Spéc — Mode Duels en salle (compétitif)

Duel live en temps réel : 2 à 8 joueurs, même distribution certifiée, premier qui finit (ou meilleur score) gagne. Classement en trophées style Clash Royale (+30/-25 avec plancher par ligue), mixé avec des bonus du quotidien. Usage visé : entre proches, salles privées avec code.

---

## 1. Principes de design

- **Équité** : tous les joueurs d'une salle reçoivent la même seed certifiée gagnable (réutiliser `findVerifiedSeed` côté serveur, déjà en place pour `/api/random-seed`).
- **Discretion** : la progression des adversaires est une petite barre (cartes fondées / 52 + score), jamais le plateau. Ça préserve le focus et empêche de copier les coups.
- **Légèreté** : le serveur ne simule jamais le jeu. Les clients jouent en local et déclarent leur progression. Le serveur relaie et arbitre le cycle de vie de la salle.
- **Confiance graduée** : usage entre proches = risque de triche faible. Garde-fous serveur bon marché quand même : temps de victoire ≥ 30 s, progression monotone (un % ne peut pas redescendre), max 1 message `progress` / 2 s / joueur.

## 2. Règles du duel

| Règle | Valeur |
|---|---|
| Joueurs | 2 à 8 |
| Distribution | Tirage 1 carte, seed certifiée générée par l'hôte via le serveur |
| Démarrage | Tous les joueurs « Prêt » → l'hôte lance → countdown 3-2-1 (5 s) |
| Undo | Autorisé (pénalité score -2 existante s'applique) |
| Restart | **Interdit** en duel (bouton désactivé) |
| Durée max | 10 min → fin forcée : si personne n'a fini, **match nul** (0 trophée pour tous) |
| Victoire | Pur sprint : premier à finir les 52 cartes. Pas de format « meilleur score en X minutes » |
| Hôte qui quitte | La salle continue si ≥ 2 joueurs, sinon annulée (aucun trophée) |
| Joueur qui quitte en cours | Forfait (-trophy défaite) sauf si < 30 s de jeu → partie ignorée |

## 3. Trophées et ligues

### Deltas de duel (N joueurs)
- 1er : **+40**
- 2e (si N ≥ 3) : **+10**
- Autres : **-20**
- Match nul (timeout, personne n'a fini) : **0 pour tous**.
- Plancher : impossible de descendre sous le palier de sa ligue actuelle.

### Ligues
| Ligue | Palier | Trophées |
|---|---|---|
| Bois | 0 | départ |
| Bronze | 300 | plancher 300 |
| Argent | 700 | plancher 700 |
| Or | 1200 | plancher 1200 |
| Diamant | 2000 | plancher 2000 |
| Légende | 3000 | plancher 3000 |

### Bonus quotidien
- Compléter le daily : **+10 trophées** (une fois par jour, hook dans le POST `/api/leaderboard` existant quand `mode === 'daily'` et première complétion).

## 4. Backend

### 4.1 Dépendance
- `ws` (WebSocket pour Node), monté sur le serveur `node:http` existant dans `server/index.ts` (écoute de l'événement `upgrade`, chemin `/ws`). Rien d'autre à changer au serveur statique.

### 4.2 État des salles : en mémoire, pas en DB
Les salles sont éphémères → `Map<string, Room>` dans le process serveur (compatible `better-sqlite3` sync, single process). SQLite ne persiste que les **résultats** et les **trophées**.

```ts
interface Room {
  code: string;                    // 5 lettres A-Z (style codes SOL-)
  hostId: string;
  seed: string;                    // générée à la création via findVerifiedSeed
  drawMode: 1 | 3;
  status: 'lobby' | 'countdown' | 'playing' | 'finished';
  startedAt?: number;              // ms epoch, référence officielle du temps
  endsAt?: number;                 // startedAt + 10 min
  countdownEndsAt?: number;
  players: Map<string, RoomPlayer>;
}

interface RoomPlayer {
  playerId: string;
  name: string;
  avatar: string;
  ready: boolean;
  connected: boolean;
  progress: number;                // fondations / 52
  foundations: Array<{ suit: Suit; rank: Rank }>; // cartes du haut des 4 fondations (pour les mini-cartes)
  score: number;
  finished: boolean;
  finishTimeSeconds?: number;      // vs startedAt
  placement?: number;              // ordre d'arrivée (ou rang final au score)
}
```

### 4.3 Protocole WebSocket
| Direction | Message | Champs |
|---|---|---|
| C→S | `create_room` | playerId, name, avatar |
| C→S | `join_room` | code, playerId, name, avatar |
| C→S | `leave_room` | — |
| C→S | `set_ready` | ready |
| C→S | `start_game` | (hôte uniquement) |
| C→S | `progress` | foundations: [{ suit, rank }] (4 cartes du haut), count, score (throttlé 2 s) |
| C→S | `finished` | score, moves, timeSeconds |
| S→C | `room_state` | snapshot complet (lobby, joueurs, ready) |
| S→C | `countdown` | endsAt |
| S→C | `game_start` | seed, drawMode, startedAt |
| S→C | `opponents` | [{ id, name, avatar, foundations: [{ suit, rank }], count, score, finished, finishTimeSeconds }] (diff après chaque progress/finished) |
| S→C | `game_over` | standings [{ placement, playerId, name, score, timeSeconds }], deltas [{ playerId, delta }] |
| S→C | `error` | code (ROOM_NOT_FOUND, ROOM_FULL, GAME_ALREADY_STARTED…) |

### 4.4 Cycle de vie
- `setInterval` serveur (1 s) : fait passer `countdown → playing`, force `playing → finished` à `endsAt`, calcule le résultat, applique les trophées, broadcast `game_over`.
- Placement : ordre d'arrivée des `finished`. À timeout sans gagnant : match nul, `deltas` à 0 pour tous.
- Persist à `game_over` : ligne par joueur dans `duel_results` + upsert `trophies` (sauf nul : historique enregistré avec delta 0, trophées inchangés).

### 4.5 SQLite (ajouts à `getDb()`)
```sql
CREATE TABLE IF NOT EXISTS trophies (
  player_id TEXT PRIMARY KEY,
  trophies INTEGER NOT NULL DEFAULT 0,
  best_trophies INTEGER NOT NULL DEFAULT 0,
  duels_played INTEGER NOT NULL DEFAULT 0,
  duel_wins INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS duel_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_code TEXT NOT NULL,
  seed TEXT NOT NULL,
  player_id TEXT NOT NULL,
  name TEXT NOT NULL,
  placement INTEGER NOT NULL,
  score INTEGER NOT NULL,
  time_seconds INTEGER NOT NULL,
  finished INTEGER NOT NULL,
  trophy_delta INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 4.6 API REST ajoutée
- `GET /api/player-trophies?playerId=` → `{ trophies, bestTrophies, league, duelsPlayed, duelWins }`
- `GET /api/duel-history?playerId=&limit=20` → dernières lignes `duel_results`
- Hook trophées daily dans le `POST /api/leaderboard` existant (mode daily, première complétion) : upsert `+10`.

## 5. Frontend

### 5.1 Hook `src/lib/state/duel.ts` — `useDuel(player)`
Machine à états unique : `idle → lobby → countdown → playing → result`.
- Connexion WS à l'ouverture du modal duel, reconnexion auto (backoff 1 s→5 s) avec reprise via `room_state`.
- Rejoue `opponents` dans un state local (memo par diff).
- Expose : `room`, `phase`, `opponents`, `createRoom()`, `joinRoom(code)`, `setReady()`, `start()`, `leave()`, `sendProgress()`, `sendFinished()`, `result`.

### 5.2 Composants
- **`DuelModal.tsx`** : deux onglets — *Créer* (bouton + code à partager en gros) et *Rejoindre* (input 5 lettres). Bandeau trophées en haut : ligue, trophées actuels, record. Onglet historique (10 derniers duels, deltas colorés).
- **`OpponentsRail.tsx`** : colonne verticale à droite du plateau (comme le widget de progression des fondations existant). Une chip par adversaire : avatar, nom tronqué, puis **4 mini-cartes (≈ 20 px)** montrant la carte du haut de chaque pile de fondation adverse (couleur + symbole + rang, réutiliser `suitSymbol` / `rankLabel` de `deck.ts`), plus une micro-barre de progression en dessous. ✓ vert + temps quand fini. CSS : réutiliser les classes `bar-progress-widget` / `found-bar` ; les mini-cartes peuvent dériver du style `CardStack` en miniature.
- **`CountdownOverlay.tsx`** : 3-2-1 plein écran semi-transparent.
- **`DuelResultModal.tsx`** (ou extension `WinScreen`) : classement final, delta de trophées par joueur (coloré +40 / -20), bouton **Revanche** (recrée une salle et renvoie le code aux mêmes joueurs).

### 5.3 Intégration dans `App.tsx`
- Nouveau bouton barre d'actions : `⚔` (duels) → ouvre `DuelModal`.
- Mode duel = nouveau `GameMode` `'duel'` (extension du type existant) : `game.newGame(1, 'duel', room.seed, 0)` au `game_start`.
- Ping de progression : effet sur `game.state.foundations` + `game.state.score` → `sendProgress()` throttlé 2 s (envoie les 4 cartes du haut des fondations : `suitSymbol`/`rankLabel`).
- Sur `game.won` en mode duel : `sendFinished()` au lieu de `submitLeaderboard` (pas d'entrée leaderboard classique en duel).
- Restart et daily-restart désactivés en mode duel.
- `OpponentsRail` rendu quand `phase === 'playing'`.
- `game_over` reçu → `DuelResultModal`.

## 6. Détails d'implémentation

- **Code de salle** : 5 lettres majuscules sans ambigus (pas de I/O/1/0). Collision → régénérer.
- **Identité** : réutiliser `player.id` / `player.name` / `player.avatar` de `src/lib/state/player.ts`. Pas d'auth supplémentaire (usage privé) ; la salle elle-même est le garde-fou.
- **Temps officiel** : `Date.now()` serveur uniquement (`startedAt`), les clients calculent leur `timeSeconds` localement mais le serveur le valide contre `startedAt` (±5 s de tolérance, sinon clamp).
- **Déconnexions** : `connected = false` au close, chip grisée ; reconnexion autorisée pendant `playing` (reprise d'état via `room_state` + `opponents`).
- **Build** : `ws` en dépendance runtime, pas d'external spécial dans `bun build` (CJS interop OK), Dockerfile inchangé (même PORT).
- **Tests** (`bun test`) : math des trophées (deltas, plancher de ligue, clamps), cycle de vie salle (lobby→playing→finished, timeout 10 min), placement et départages, garde-fous anti-spam progress.

## 7. Hors périmètre (v2 éventuelle)
- Défis fantômes asynchrones (rejouer le run d'un ami).
- Matchmaking global / matchmaking par trophées.
- Chat (emotes seulement si besoin).
- Battle royale style Tetris 99 (éliminations échelonnées).
- Spectateurs.

## 8. Ordre d'implémentation
1. **Serveur** : `ws` + `server/rooms.ts` (cycle de vie, protocole, tick) + tables SQLite + API trophées.
2. **Client état** : `useDuel` (WS, reconnexion, machine à états) + mode `'duel'` dans le moteur.
3. **UI** : `DuelModal`, `CountdownOverlay`, `OpponentsRail`, intégration `App.tsx`.
4. **Résultats** : `DuelResultModal`, deltas, Revanche, hook daily +10.
5. **Polish** : historique, sons légers éventuels, animations des deltas.

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const DUEL_FIRST = 40;
export const DUEL_SECOND = 10;
export const DUEL_LOSS = -20;
export const DUEL_DRAW = 0;
export const DAILY_BONUS = 10;

export interface League {
	name: string;
	min: number;
}

export const LEAGUES: readonly League[] = [
	{ name: 'Bois', min: 0 },
	{ name: 'Bronze', min: 300 },
	{ name: 'Argent', min: 700 },
	{ name: 'Or', min: 1200 },
	{ name: 'Diamant', min: 2000 },
	{ name: 'Légende', min: 3000 }
];

export function leagueFor(trophies: number): League {
	let current = LEAGUES[0];
	for (const league of LEAGUES) {
		if (trophies >= league.min) current = league;
	}
	return current;
}

export function leagueFloor(trophies: number): number {
	return leagueFor(trophies).min;
}

/**
 * Deltas d'un duel. `placements` : placement par joueur (1 = premier, null = non fini).
 * `draw` = match nul (timeout sans gagnant) : 0 pour tous.
 * En duel à 2 joueurs, le perdant prend la défaite (-20) ; à 3+, le 2e est récompensé (+10).
 */
export function duelDeltas(placements: Array<number | null>, draw = false, playerCount = 2): number[] {
	if (draw) return placements.map(() => DUEL_DRAW);
	return placements.map((placement) => {
		if (placement === 1) return DUEL_FIRST;
		if (placement === 2 && playerCount >= 3) return DUEL_SECOND;
		return DUEL_LOSS;
	});
}

/** Applique un delta en respectant le plancher de la ligue actuelle du joueur. */
export function applyTrophyDelta(current: number, delta: number): number {
	return Math.max(0, current + delta, leagueFloor(current));
}

export interface DuelResultRow {
	playerId: string;
	name: string;
	placement: number | null;
	score: number;
	timeSeconds: number;
	finished: boolean;
	trophyDelta: number;
}

export interface DuelAwardSummary {
	playerId: string;
	trophies: number;
	delta: number;
}

export interface TrophyProfile {
	playerId: string;
	name: string;
	trophies: number;
	bestTrophies: number;
	duelsPlayed: number;
	duelWins: number;
	league: string;
}

let sharedDb: Database.Database | null = null;

export function getSharedDb(): Database.Database {
	if (sharedDb) return sharedDb;
	const dataDir = process.env.DATA_DIR ?? 'data';
	if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
	sharedDb = new Database(join(dataDir, 'leaderboard.db'));
	ensureTrophyTables(sharedDb);
	return sharedDb;
}

export function ensureTrophyTables(db: Database.Database): void {
	db.exec(`
		CREATE TABLE IF NOT EXISTS trophies (
			player_id TEXT PRIMARY KEY,
			name TEXT NOT NULL DEFAULT '',
			trophies INTEGER NOT NULL DEFAULT 0,
			best_trophies INTEGER NOT NULL DEFAULT 0,
			duels_played INTEGER NOT NULL DEFAULT 0,
			duel_wins INTEGER NOT NULL DEFAULT 0,
			daily_bonus_date TEXT NOT NULL DEFAULT '',
			updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS duel_results (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			room_code TEXT NOT NULL,
			seed TEXT NOT NULL,
			player_id TEXT NOT NULL,
			name TEXT NOT NULL,
			placement INTEGER,
			score INTEGER NOT NULL,
			time_seconds INTEGER NOT NULL,
			finished INTEGER NOT NULL,
			trophy_delta INTEGER NOT NULL,
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		);
	`);
}

export function getTrophyProfile(db: Database.Database, playerId: string): TrophyProfile | null {
	const row = db.prepare(`
		SELECT player_id AS playerId, name, trophies, best_trophies AS bestTrophies,
			duels_played AS duelsPlayed, duel_wins AS duelWins
		FROM trophies WHERE player_id = ?
	`).get(playerId) as Omit<TrophyProfile, 'league'> | undefined;
	if (!row) return null;
	return { ...row, league: leagueFor(row.trophies).name };
}

export function getDuelHistory(db: Database.Database, playerId: string, limit = 20): Array<{
	roomCode: string; seed: string; placement: number | null; score: number; timeSeconds: number; finished: boolean; trophyDelta: number; createdAt: string;
}> {
	return db.prepare(`
		SELECT room_code AS roomCode, seed, placement, score, time_seconds AS timeSeconds,
			finished, trophy_delta AS trophyDelta, created_at AS createdAt
		FROM duel_results WHERE player_id = ? ORDER BY id DESC LIMIT ?
	`).all(playerId, Math.min(100, Math.max(1, limit))) as never;
}

/** Classement trophées global (pour le leaderboard). */
export function getTrophiesLeaderboard(db: Database.Database, limit = 50): Array<{
	playerId: string; name: string; trophies: number; bestTrophies: number; duelsPlayed: number; duelWins: number; league: string;
}> {
	const rows = db.prepare(`
		SELECT player_id AS playerId, name, trophies, best_trophies AS bestTrophies,
			duels_played AS duelsPlayed, duel_wins AS duelWins
		FROM trophies
		WHERE duels_played > 0 OR trophies > 0
		ORDER BY trophies DESC, duel_wins DESC
		LIMIT ?
	`).all(Math.min(100, Math.max(1, limit))) as Array<Omit<import('./trophies').TrophyProfile, 'league'>>;
	return rows.map((row) => ({ ...row, league: leagueFor(row.trophies).name }));
}

/** Enregistre le résultat d'un duel et applique les trophées (avec planchers). */
export function applyDuelResults(db: Database.Database, roomCode: string, seed: string, results: DuelResultRow[]): DuelAwardSummary[] {
	const insert = db.prepare(`
		INSERT INTO duel_results (room_code, seed, player_id, name, placement, score, time_seconds, finished, trophy_delta)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`);
	const select = db.prepare('SELECT trophies FROM trophies WHERE player_id = ?');
	const upsert = db.prepare(`
		INSERT INTO trophies (player_id, name, trophies, best_trophies, duels_played, duel_wins, updated_at)
		VALUES (?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(player_id) DO UPDATE SET
			name = excluded.name,
			trophies = excluded.trophies,
			best_trophies = MAX(best_trophies, excluded.trophies),
			duels_played = duels_played + 1,
			duel_wins = duel_wins + excluded.duel_wins,
			updated_at = CURRENT_TIMESTAMP
	`);

	const summaries: DuelAwardSummary[] = [];
	const apply = db.transaction(() => {
		for (const result of results) {
			insert.run(roomCode, seed, result.playerId, result.name, result.placement, result.score, result.timeSeconds, result.finished ? 1 : 0, result.trophyDelta);
			const current = (select.get(result.playerId) as { trophies?: number } | undefined)?.trophies ?? 0;
			const next = applyTrophyDelta(current, result.trophyDelta);
			upsert.run(result.playerId, result.name, next, next, result.placement === 1 ? 1 : 0);
			summaries.push({ playerId: result.playerId, trophies: next, delta: result.trophyDelta });
		}
	});
	apply();
	return summaries;
}

/** Bonus quotidien : +10 trophées à la première complétion du daily du jour. */
export function awardDailyBonus(db: Database.Database, playerId: string, name: string, date: string): { awarded: boolean; trophies: number } {
	const row = db.prepare('SELECT trophies, daily_bonus_date FROM trophies WHERE player_id = ?').get(playerId) as { trophies?: number; daily_bonus_date?: string } | undefined;
	const current = row?.trophies ?? 0;
	if (row?.daily_bonus_date === date) return { awarded: false, trophies: current };
	const next = applyTrophyDelta(current, DAILY_BONUS);
	db.prepare(`
		INSERT INTO trophies (player_id, name, trophies, best_trophies, daily_bonus_date, updated_at)
		VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(player_id) DO UPDATE SET
			name = excluded.name,
			trophies = excluded.trophies,
			best_trophies = MAX(best_trophies, excluded.trophies),
			daily_bonus_date = excluded.daily_bonus_date,
			updated_at = CURRENT_TIMESTAMP
	`).run(playerId, name, next, 0, date);
	return { awarded: true, trophies: next };
}

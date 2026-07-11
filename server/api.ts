import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { findVerifiedSeed, type VerifiedSeedResult } from '../src/lib/game/solver';
import { todaySeed } from '../src/lib/game/seedRng';

interface ApiRequest {
	method: string;
	url: string;
	body?: unknown;
}

interface ApiResponse {
	status: number;
	headers?: Record<string, string>;
	body: unknown;
}

interface LeaderboardBody {
	playerId?: string;
	name?: string;
	score?: number;
	moves?: number;
	timeSeconds?: number;
	date?: string;
	mode?: 'daily' | 'random';
	seed?: string;
	restarts?: number;
	streak?: number;
}

const dailySeedCache = new Map<string, VerifiedSeedResult>();

export async function handleApiRequest(req: ApiRequest): Promise<ApiResponse> {
	const url = new URL(req.url, 'http://localhost');
	const method = req.method.toUpperCase();

	if (method === 'GET' && url.pathname === '/api/daily-seed') {
		const date = todaySeed();
		if (!dailySeedCache.has(date)) {
			dailySeedCache.clear();
			const deal = findVerifiedSeed(date, 1, 40);
			if (!deal) return json({ error: 'Could not verify a challenging daily deal. Please try again.' }, 503);
			dailySeedCache.set(date, deal);
		}
		return json({ ...dailySeedCache.get(date), verified: true });
	}

	if (method === 'GET' && url.pathname === '/api/random-seed') {
		const baseSeed = sanitizeSeed(url.searchParams.get('base') ?? '') || randomSeed();
		const deal = findVerifiedSeed(baseSeed, 1, 32);
		if (!deal) return json({ error: 'Could not verify a challenging random deal. Please try again.' }, 503);
		return json({ ...deal, verified: true });
	}

	if (method === 'POST' && url.pathname === '/api/player') {
		const body = req.body as LeaderboardBody;
		const playerId = sanitizeId(body?.playerId ?? (body as LeaderboardBody & { id?: string })?.id ?? '');
		if (!playerId) return json({ error: 'missing playerId' }, 400);
		const db = getDb();
		registerPlayer(db, playerId, body.name);
		db.close();
		return json({ ok: true });
	}

	if (method === 'GET' && url.pathname === '/api/daily-status') {
		const playerId = sanitizeId(url.searchParams.get('playerId') ?? '');
		const name = sanitizeName(url.searchParams.get('name') ?? '');
		const date = sanitizeDate(url.searchParams.get('date') ?? todaySeed());
		if (!playerId) return json({ error: 'missing playerId' }, 400);
		const db = getDb();
		registerPlayer(db, playerId, name);
		const status = getDailyStatus(db, playerId, date);
		db.close();
		return json(status);
	}

	if (method === 'POST' && url.pathname === '/api/daily-restart') {
		const body = req.body as LeaderboardBody;
		const playerId = sanitizeId(body?.playerId ?? '');
		const name = sanitizeName(body?.name ?? '');
		const date = sanitizeDate(body?.date ?? todaySeed());
		const seed = String(body?.seed ?? '');
		if (!playerId) return json({ error: 'missing playerId' }, 400);
		const db = getDb();
		registerPlayer(db, playerId, name);
		ensureDailyAttempt(db, playerId, date, seed);
		const status = getDailyStatus(db, playerId, date);
		if (!status.completed) {
			db.prepare(`
				UPDATE daily_attempts
				SET restarts = restarts + 1, seed = COALESCE(NULLIF(?, ''), seed)
				WHERE player_id = ? AND date = ?
			`).run(seed, playerId, date);
		}
		const next = getDailyStatus(db, playerId, date);
		db.close();
		return json(next);
	}

	if (method === 'GET' && url.pathname === '/api/leaderboard') {
		const db = getDb();
		const rows = db.prepare(`
			SELECT player_id AS playerId, name, score, moves, time_seconds AS timeSeconds,
				date, mode, seed, restarts, streak
			FROM entries
			ORDER BY score DESC, time_seconds ASC
			LIMIT 200
		`).all();
		db.close();
		return json(rows);
	}

	if (method === 'POST' && url.pathname === '/api/leaderboard') {
		const body = req.body as LeaderboardBody;
		const playerId = sanitizeId(body?.playerId ?? '');
		const name = sanitizeName(body?.name ?? '');
		const score = Number(body?.score);
		const moves = Number(body?.moves ?? 0);
		const timeSeconds = Number(body?.timeSeconds ?? 0);
		const date = sanitizeDate(body?.date ?? todaySeed());
		const mode = body?.mode === 'daily' ? 'daily' : body?.mode === 'random' ? 'random' : '';
		const seed = String(body?.seed ?? '');
		if (!playerId || !name || !Number.isFinite(score) || !date || !mode || !seed) {
			return json({ error: 'missing fields' }, 400);
		}

		const db = getDb();
		registerPlayer(db, playerId, name);
		let restarts = Math.max(0, Number(body?.restarts ?? 0));
		let streak = Math.max(0, Number(body?.streak ?? 0));

		if (mode === 'daily') {
			ensureDailyAttempt(db, playerId, date, seed);
			const attempt = db.prepare('SELECT restarts FROM daily_attempts WHERE player_id = ? AND date = ?').get(playerId, date) as { restarts?: number } | undefined;
			restarts = Math.max(restarts, Number(attempt?.restarts ?? 0));
			const existing = db.prepare(`
				SELECT id FROM entries WHERE player_id = ? AND date = ? AND mode = 'daily' LIMIT 1
			`).get(playerId, date);
			if (existing) {
				db.close();
				return json({ ok: true, alreadyCompleted: true });
			}
			streak = computeCompletionStreak(db, playerId, date);
			db.prepare(`
				UPDATE daily_attempts SET completed_at = datetime('now'), restarts = ? WHERE player_id = ? AND date = ?
			`).run(restarts, playerId, date);
		}

		db.prepare(`
			INSERT INTO entries (player_id, name, score, moves, time_seconds, date, mode, seed, restarts, streak)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`).run(playerId, name, score, moves, timeSeconds, date, mode, seed, restarts, streak);
		db.close();
		return json({ ok: true, streak, restarts });
	}

	return json({ error: 'not found' }, 404);
}

function getDb() {
	const dataDir = process.env.DATA_DIR ?? 'data';
	if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
	const db = new Database(join(dataDir, 'leaderboard.db'));
	db.exec(`
		CREATE TABLE IF NOT EXISTS players (
			player_id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS entries (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			player_id TEXT NOT NULL DEFAULT '',
			name TEXT NOT NULL,
			score INTEGER NOT NULL,
			moves INTEGER NOT NULL,
			time_seconds INTEGER NOT NULL,
			date TEXT NOT NULL,
			mode TEXT NOT NULL,
			seed TEXT NOT NULL,
			restarts INTEGER NOT NULL DEFAULT 0,
			streak INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS daily_attempts (
			player_id TEXT NOT NULL,
			date TEXT NOT NULL,
			seed TEXT NOT NULL,
			restarts INTEGER NOT NULL DEFAULT 0,
			started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
			completed_at TEXT,
			PRIMARY KEY (player_id, date)
		);
	`);
	ensureColumn(db, 'entries', 'player_id', "TEXT NOT NULL DEFAULT ''");
	ensureColumn(db, 'entries', 'restarts', 'INTEGER NOT NULL DEFAULT 0');
	ensureColumn(db, 'entries', 'streak', 'INTEGER NOT NULL DEFAULT 0');
	ensureColumn(db, 'entries', 'created_at', "TEXT NOT NULL DEFAULT ''");
	return db;
}

function ensureColumn(db: Database.Database, table: string, column: string, definition: string): void {
	const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
	if (!rows.some((row) => row.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function registerPlayer(db: Database.Database, playerId: string, name = ''): void {
	const safeName = sanitizeName(name);
	db.prepare(`
		INSERT INTO players (player_id, name) VALUES (?, ?)
		ON CONFLICT(player_id) DO UPDATE SET name = excluded.name, updated_at = CURRENT_TIMESTAMP
	`).run(playerId, safeName);
}

function ensureDailyAttempt(db: Database.Database, playerId: string, date: string, seed: string): void {
	db.prepare(`
		INSERT OR IGNORE INTO daily_attempts (player_id, date, seed) VALUES (?, ?, ?)
	`).run(playerId, date, seed);
	if (seed) {
		db.prepare(`
			UPDATE daily_attempts SET seed = ? WHERE player_id = ? AND date = ? AND completed_at IS NULL
		`).run(seed, playerId, date);
	}
}

function getDailyStatus(db: Database.Database, playerId: string, date: string) {
	const attempt = db.prepare(`
		SELECT restarts, completed_at AS completedAt FROM daily_attempts WHERE player_id = ? AND date = ?
	`).get(playerId, date) as { restarts?: number; completedAt?: string | null } | undefined;
	const entry = db.prepare(`
		SELECT restarts, streak FROM entries WHERE player_id = ? AND date = ? AND mode = 'daily' LIMIT 1
	`).get(playerId, date) as { restarts?: number; streak?: number } | undefined;
	return {
		date,
		started: !!attempt || !!entry,
		completed: !!attempt?.completedAt || !!entry,
		restarts: Math.max(Number(attempt?.restarts ?? 0), Number(entry?.restarts ?? 0)),
		streak: currentStreak(db, playerId, date)
	};
}

function computeCompletionStreak(db: Database.Database, playerId: string, date: string): number {
	const yesterday = addDays(date, -1);
	const previous = db.prepare(`
		SELECT streak FROM entries WHERE player_id = ? AND date = ? AND mode = 'daily' LIMIT 1
	`).get(playerId, yesterday) as { streak?: number } | undefined;
	return Number(previous?.streak ?? 0) + 1;
}

function currentStreak(db: Database.Database, playerId: string, date: string): number {
	const current = db.prepare(`
		SELECT streak FROM entries WHERE player_id = ? AND date = ? AND mode = 'daily' LIMIT 1
	`).get(playerId, date) as { streak?: number } | undefined;
	if (current) return Number(current.streak ?? 0);

	const last = db.prepare(`
		SELECT date, streak FROM entries WHERE player_id = ? AND mode = 'daily' ORDER BY date DESC LIMIT 1
	`).get(playerId) as { date?: string; streak?: number } | undefined;
	if (last?.date === addDays(date, -1)) return Number(last.streak ?? 0);
	return 0;
}

function addDays(date: string, days: number): string {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function sanitizeId(id: string): string {
	return String(id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
}

function sanitizeName(name = ''): string {
	const clean = String(name).replace(/\s+/g, ' ').trim().slice(0, 20);
	return clean || 'Anonymous Ace';
}

function sanitizeDate(date: string): string {
	return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todaySeed();
}

function sanitizeSeed(seed: string): string {
	return String(seed).replace(/[^a-zA-Z0-9._:-]/g, '').slice(0, 120);
}

function randomSeed(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function json(body: unknown, status = 200): ApiResponse {
	return { status, headers: { 'Cache-Control': 'no-store' }, body };
}

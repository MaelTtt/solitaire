import { json, type RequestEvent } from '@sveltejs/kit';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';

const DATA_DIR = process.env.DATA_DIR ?? 'data';

function getDb() {
	if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
	const db = new Database(`${DATA_DIR}/leaderboard.db`);
	db.exec(`
		CREATE TABLE IF NOT EXISTS entries (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			score INTEGER NOT NULL,
			moves INTEGER NOT NULL,
			time_seconds INTEGER NOT NULL,
			date TEXT NOT NULL,
			mode TEXT NOT NULL,
			seed TEXT NOT NULL
		)
	`);
	return db;
}

export function GET() {
	const db = getDb();
	const rows = db.prepare(`
		SELECT name, score, moves, time_seconds AS timeSeconds, date, mode, seed
		FROM entries ORDER BY score DESC LIMIT 200
	`).all();
	db.close();
	return json(rows);
};

export async function POST({ request }: RequestEvent) {
	const body = await request.json();
	const { name, score, moves, timeSeconds, date, mode, seed } = body;
	if (!name || score == null || !date || !mode || !seed) {
		return json({ error: 'missing fields' }, { status: 400 });
	}
	const db = getDb();
	db.prepare(`
		INSERT INTO entries (name, score, moves, time_seconds, date, mode, seed)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`).run(name, score, moves ?? 0, timeSeconds ?? 0, date, mode, seed);
	db.close();
	return json({ ok: true });
};

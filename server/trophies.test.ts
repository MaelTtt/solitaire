import { describe, expect, test } from 'bun:test';
import {
	applyDuelResults,
	applyTrophyDelta,
	awardDailyBonus,
	duelDeltas,
	DUEL_FIRST,
	DUEL_LOSS,
	DUEL_SECOND,
	getDuelHistory,
	getTrophyProfile,
	leagueFloor,
	leagueFor
} from './trophies';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';

describe('leagues', () => {
	test('returns the highest league whose floor is reached', () => {
		expect(leagueFor(0).name).toBe('Bois');
		expect(leagueFor(299).name).toBe('Bois');
		expect(leagueFor(300).name).toBe('Bronze');
		expect(leagueFor(699).name).toBe('Bronze');
		expect(leagueFor(700).name).toBe('Argent');
		expect(leagueFor(1200).name).toBe('Or');
		expect(leagueFor(2999).name).toBe('Diamant');
		expect(leagueFor(3000).name).toBe('Légende');
		expect(leagueFor(9999).name).toBe('Légende');
	});

	test('floors match league thresholds', () => {
		expect(leagueFloor(0)).toBe(0);
		expect(leagueFloor(350)).toBe(300);
		expect(leagueFloor(300)).toBe(300);
		expect(leagueFloor(299)).toBe(0);
		expect(leagueFloor(2000)).toBe(2000);
	});
});

describe('duel deltas', () => {
	test('two-player duel: winner +40, loser -20', () => {
		expect(duelDeltas([1, null], false, 2)).toEqual([DUEL_FIRST, DUEL_LOSS]);
		expect(duelDeltas([1, 2], false, 2)).toEqual([DUEL_FIRST, DUEL_LOSS]);
	});

	test('three-player duel: 2nd place earns a small reward', () => {
		expect(duelDeltas([1, 2, null], false, 3)).toEqual([DUEL_FIRST, DUEL_SECOND, DUEL_LOSS]);
	});

	test('draw gives zero to everyone', () => {
		expect(duelDeltas([null, null, null], true, 3)).toEqual([0, 0, 0]);
	});
});

describe('applyTrophyDelta', () => {
	test('adds and subtracts normally above the floor', () => {
		expect(applyTrophyDelta(500, DUEL_FIRST)).toBe(540);
		expect(applyTrophyDelta(500, DUEL_LOSS)).toBe(480);
	});

	test('never drops below the current league floor', () => {
		expect(applyTrophyDelta(310, DUEL_LOSS)).toBe(300);
		expect(applyTrophyDelta(300, DUEL_LOSS)).toBe(300);
		expect(applyTrophyDelta(0, DUEL_LOSS)).toBe(0);
	});

	test('promotion happens by crossing the threshold', () => {
		expect(applyTrophyDelta(290, DUEL_FIRST)).toBe(330);
		expect(leagueFor(applyTrophyDelta(290, DUEL_FIRST)).name).toBe('Bronze');
	});
});

describe('sqlite persistence', () => {
	test('duel results update trophies with floors and history', () => {
		const dir = mkdtempSync(join(tmpdir(), 'solitaire-test-'));
		const db = new Database(join(dir, 'test.db'));
		db.exec(`
			CREATE TABLE trophies (player_id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '', trophies INTEGER NOT NULL DEFAULT 0,
				best_trophies INTEGER NOT NULL DEFAULT 0, duels_played INTEGER NOT NULL DEFAULT 0, duel_wins INTEGER NOT NULL DEFAULT 0,
				daily_bonus_date TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
			CREATE TABLE duel_results (id INTEGER PRIMARY KEY AUTOINCREMENT, room_code TEXT NOT NULL, seed TEXT NOT NULL,
				player_id TEXT NOT NULL, name TEXT NOT NULL, placement INTEGER, score INTEGER NOT NULL, time_seconds INTEGER NOT NULL,
				finished INTEGER NOT NULL, trophy_delta INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
		`);

		const summaries = applyDuelResults(db, 'ROOM1', 'seed-x', [
			{ playerId: 'p1', name: 'Alice', placement: 1, score: 500, timeSeconds: 200, finished: true, trophyDelta: DUEL_FIRST },
			{ playerId: 'p2', name: 'Bob', placement: null, score: 120, timeSeconds: 240, finished: false, trophyDelta: DUEL_LOSS }
		]);

		expect(summaries.find((s) => s.playerId === 'p1')?.trophies).toBe(DUEL_FIRST);
		expect(summaries.find((s) => s.playerId === 'p2')?.trophies).toBe(0); // plancher Bois : pas de négatif

		const profile = getTrophyProfile(db, 'p1');
		expect(profile?.trophies).toBe(DUEL_FIRST);
		expect(profile?.duelsPlayed).toBe(1);
		expect(profile?.duelWins).toBe(1);
		expect(profile?.league).toBe('Bois');

		expect(getDuelHistory(db, 'p1')).toHaveLength(1);

		// Défaite au plancher : reste à 0
		applyDuelResults(db, 'ROOM2', 'seed-y', [
			{ playerId: 'p2', name: 'Bob', placement: null, score: 10, timeSeconds: 300, finished: false, trophyDelta: DUEL_LOSS }
		]);
		expect(getTrophyProfile(db, 'p2')?.trophies).toBe(0);
		db.close();
	});

	test('daily bonus is awarded once per day', () => {
		const dir = mkdtempSync(join(tmpdir(), 'solitaire-test-'));
		const db = new Database(join(dir, 'test.db'));
		db.exec(`
			CREATE TABLE trophies (player_id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '', trophies INTEGER NOT NULL DEFAULT 0,
				best_trophies INTEGER NOT NULL DEFAULT 0, duels_played INTEGER NOT NULL DEFAULT 0, duel_wins INTEGER NOT NULL DEFAULT 0,
				daily_bonus_date TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
		`);

		const first = awardDailyBonus(db, 'p1', 'Alice', '2026-08-27');
		expect(first.awarded).toBe(true);
		expect(first.trophies).toBe(10);

		const second = awardDailyBonus(db, 'p1', 'Alice', '2026-08-27');
		expect(second.awarded).toBe(false);
		expect(second.trophies).toBe(10);

		const nextDay = awardDailyBonus(db, 'p1', 'Alice', '2026-08-28');
		expect(nextDay.awarded).toBe(true);
		expect(nextDay.trophies).toBe(20);
		db.close();
	});
});

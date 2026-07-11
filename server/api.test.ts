import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { todaySeed } from '../src/lib/game/seedRng';
import { handleApiRequest } from './api';

let dataDir = '';

beforeAll(() => {
	dataDir = mkdtempSync(join(tmpdir(), 'solitaire-api-test-'));
	process.env.DATA_DIR = dataDir;
});

afterAll(() => {
	delete process.env.DATA_DIR;
	rmSync(dataDir, { recursive: true, force: true });
});

describe('certified seed API', () => {
	test('returns one deterministic verified daily seed', async () => {
		const first = await handleApiRequest({ method: 'GET', url: '/api/daily-seed' });
		const second = await handleApiRequest({ method: 'GET', url: '/api/daily-seed' });

		expect(first.status).toBe(200);
		expect(first.body).toMatchObject({
			seed: expect.stringMatching(`^verified-v3:${todaySeed()}#\\d+$`),
			verified: true,
			difficulty: expect.any(Number),
			solutionMoves: expect.any(Number),
			exploredStates: expect.any(Number)
		});
		expect(second.body).toEqual(first.body);
	});

	test('returns a sanitized verified random seed', async () => {
		const response = await handleApiRequest({
			method: 'GET',
			url: '/api/random-seed?base=random%20seed%2Fone'
		});

		expect(response.status).toBe(200);
		expect(response.body).toMatchObject({
			seed: expect.stringMatching(/^verified-v3:randomseedone#\d+$/),
			verified: true,
			difficulty: expect.any(Number)
		});
	});
});

describe('leaderboard completion flow', () => {
	test('stores a completed game and returns it from the leaderboard', async () => {
		const entry = {
			playerId: 'integration-player',
			name: 'Integration Ace',
			score: 1234,
			moves: 91,
			timeSeconds: 245,
			date: todaySeed(),
			mode: 'daily' as const,
			seed: `verified-v3:${todaySeed()}#3`,
			restarts: 1,
			streak: 0
		};

		const submitted = await handleApiRequest({
			method: 'POST',
			url: '/api/leaderboard',
			body: entry
		});
		expect(submitted.status).toBe(200);
		expect(submitted.body).toMatchObject({ ok: true, restarts: 1, streak: 1 });

		const leaderboard = await handleApiRequest({ method: 'GET', url: '/api/leaderboard' });
		expect(leaderboard.status).toBe(200);
		expect(leaderboard.body).toEqual(expect.arrayContaining([
			expect.objectContaining({
				playerId: entry.playerId,
				name: entry.name,
				score: entry.score,
				moves: entry.moves,
				timeSeconds: entry.timeSeconds,
				mode: entry.mode,
				seed: entry.seed,
				restarts: entry.restarts,
				streak: 1
			})
		]));

		const status = await handleApiRequest({
			method: 'GET',
			url: `/api/daily-status?playerId=${entry.playerId}&name=${encodeURIComponent(entry.name)}&date=${entry.date}`
		});
		expect(status.body).toMatchObject({ completed: true, restarts: 1, streak: 1 });
	});
});

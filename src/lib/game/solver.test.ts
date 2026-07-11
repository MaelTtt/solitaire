import { describe, expect, test } from 'bun:test';
import {
	createCertifiedSeed,
	dealSeededState,
	findVerifiedSeed,
	matchesSeedBase,
	solveKlondike,
	verifyCertifiedDeal
} from './solver';

describe('verified shuffled deals', () => {
	test('selects a normal-looking proven deal instead of exposing low cards', () => {
		const result = findVerifiedSeed('2026-07-11', 1, 8);

		expect(result).not.toBeNull();
		const state = dealSeededState(1, 'daily', result!.seed);
		const exposed = state.tableau.map((pile) => pile[pile.length - 1]);
		expect(result!.seed).toMatch(/^verified-v3:2026-07-11#\d+$/);
		expect(exposed.some((card) => card.rank === 1)).toBe(false);
		expect(exposed.filter((card) => card.rank <= 4).length).toBeLessThanOrEqual(2);
		expect(solveKlondike(state, { maxVisitedStates: 10000 }).solved).toBe(true);
		expect(result!.solutionMoves).toBeGreaterThanOrEqual(75);
	});
});

describe('certified deals', () => {
	test.each([1, 3] as const)('constructs a proven solvable draw-%i deal', (drawMode) => {
		const seed = createCertifiedSeed('2026-07-11');

		expect(seed).toBe('certified-v2:2026-07-11');
		const state = dealSeededState(drawMode, 'daily', seed);
		expect(verifyCertifiedDeal(state)).toBe(true);
	});

	test('deals the same certified seed exactly and without duplicate cards', () => {
		const first = dealSeededState(1, 'random', 'certified-v2:repeatable');
		const second = dealSeededState(1, 'random', 'certified-v2:repeatable');
		const cardIds = [
			...first.stock,
			...first.tableau.flat()
		].map((card) => card.id);

		expect(first.seed).toBe('certified-v2:repeatable');
		expect(first.tableau.map((pile) => pile.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
		expect(cardIds).toHaveLength(52);
		expect(new Set(cardIds).size).toBe(52);
		expect(snapshot(first)).toEqual(snapshot(second));
	});

	test('produces varied certified layouts across a seed corpus', () => {
		const layouts = new Set<string>();
		const topRankPatterns = new Set<string>();

		for (let index = 0; index < 100; index++) {
			const state = dealSeededState(1, 'random', createCertifiedSeed(`variety-${index}`));
			expect(verifyCertifiedDeal(state)).toBe(true);
			layouts.add(JSON.stringify(snapshot(state)));
			topRankPatterns.add(state.tableau.map((pile) => pile[pile.length - 1].rank).join(','));
		}

		expect(layouts.size).toBe(100);
		expect(topRankPatterns.size).toBeGreaterThan(20);
	});

	test('recognizes current daily seeds and invalidates easy certified versions', () => {
		expect(matchesSeedBase('2026-07-11', '2026-07-11')).toBe(true);
		expect(matchesSeedBase('2026-07-11#4', '2026-07-11')).toBe(true);
		expect(matchesSeedBase('certified:2026-07-11', '2026-07-11')).toBe(false);
		expect(matchesSeedBase('certified-v2:2026-07-11', '2026-07-11')).toBe(false);
		expect(matchesSeedBase('verified-v3:2026-07-11#3', '2026-07-11')).toBe(true);
		expect(matchesSeedBase('certified-v2:2026-07-10', '2026-07-11')).toBe(false);
	});

	test('preserves version-one certified deals for leaderboard replays', () => {
		const state = dealSeededState(1, 'random', 'certified:legacy-certified');

		expect(state.seed).toBe('certified:legacy-certified');
		expect(verifyCertifiedDeal(state)).toBe(true);
	});

	test('preserves legacy shuffled seeds for leaderboard replays', () => {
		const state = dealSeededState(1, 'random', 'legacy-seed');

		expect(state.seed).toBe('legacy-seed');
		expect(state.tableau.map((pile) => pile.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
		expect(state.stock).toHaveLength(24);
	});
});

function snapshot(state: ReturnType<typeof dealSeededState>) {
	return {
		stock: state.stock.map((card) => card.id),
		tableau: state.tableau.map((pile) => pile.map((card) => `${card.id}:${card.faceUp}`))
	};
}

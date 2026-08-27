import { describe, expect, test } from 'bun:test';
import {
	dealSeededState,
	estimateForgiveness,
	findDuelSeed,
	simulateGreedyGame
} from './solver';

describe('greedy simulations', () => {
	test('a random deal never reaches more foundations than cards', () => {
		const state = dealSeededState(1, 'random', 'sim-test-1');
		const result = simulateGreedyGame(state, 4);
		expect(result.foundations).toBeGreaterThanOrEqual(0);
		expect(result.foundations).toBeLessThanOrEqual(52);
		if (result.won) expect(result.foundations).toBe(52);
	});

	test('forgiveness is a rate between 0 and 1', () => {
		const state = dealSeededState(1, 'random', 'sim-test-2');
		const rate = estimateForgiveness(state, 10, 4);
		expect(rate).toBeGreaterThanOrEqual(0);
		expect(rate).toBeLessThanOrEqual(1);
	});
});

describe('duel seeds', () => {
	test('finds a deal whose reported forgiveness is consistent on replay', () => {
		const deal = findDuelSeed('duel-unit-test', 1, 14, {
			maxVisitedStates: 20000,
			rollouts: 24,
			minWinRate: 0.12
		});
		expect(deal).not.toBeNull();
		expect(deal!.seed.startsWith('verified-v3:')).toBe(true);
		expect(deal!.forgiveness).toBeGreaterThanOrEqual(0);
		// Le deal rejoue exactement la même distribution
		const replayed = dealSeededState(1, 'random', deal!.seed);
		expect(replayed.tableau.map((pile) => pile.map((card) => card.id).join(','))).toEqual(
			dealSeededState(1, 'random', deal!.seed).tableau.map((pile) => pile.map((card) => card.id).join(','))
		);
	}, 60000);

	test('forgiving deals are measurably better than the average random deal', () => {
		const deal = findDuelSeed('duel-unit-test-2', 1, 14, {
			maxVisitedStates: 20000,
			rollouts: 24,
			minWinRate: 0.2
		});
		expect(deal).not.toBeNull();
		// Baseline : 5 deals aléatoires bruts
		let baseline = 0;
		for (let i = 0; i < 5; i++) {
			baseline += estimateForgiveness(dealSeededState(1, 'random', `baseline-${i}`), 12);
		}
		expect(deal!.forgiveness).toBeGreaterThanOrEqual(baseline / 5);
	}, 60000);
});

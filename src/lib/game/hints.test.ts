import { describe, expect, test } from 'bun:test';
import type { GameState, Rank, Suit } from './types';
import { canAutoComplete, enumerateLegalMoves, getHint, hasAnyBoardMove } from './hints';

describe('move hints', () => {
	test('detects tableau moves starting below the first face-up card', () => {
		const state = emptyState();
		state.tableau[0] = [
			card('hearts', 1, false),
			card('clubs', 10),
			card('diamonds', 9)
		];
		state.tableau[1] = [card('spades', 10)];

		const moves = enumerateLegalMoves(state, false);

		expect(hasAnyBoardMove(state)).toBe(true);
		expect(moves.some((move) => move.from.type === 'tableau' && move.from.index === 0 && move.to.index === 1 && move.cardId === 'diamonds-9')).toBe(true);
	});

	test('auto-complete can finish by drawing the remaining stock card', () => {
		const state = emptyState();
		state.foundations = [
			ranks(1, 12).map((rank) => card('spades', rank)),
			ranks(1, 13).map((rank) => card('hearts', rank)),
			ranks(1, 13).map((rank) => card('diamonds', rank)),
			ranks(1, 13).map((rank) => card('clubs', rank))
		];
		state.stock = [card('spades', 13, false)];

		expect(canAutoComplete(state)).toBe(true);
	});

	test('does not hint reversible tableau ping-pong moves', () => {
		const state = emptyState();
		state.tableau[0] = [card('spades', 13), card('hearts', 12)];
		state.tableau[1] = [card('clubs', 13)];
		state.stock = [card('diamonds', 1, false)];

		const hint = getHint(state);

		expect(hint?.kind).toBe('stock');
	});
});

function emptyState(): GameState {
	return {
		stock: [],
		waste: [],
		foundations: [[], [], [], []],
		tableau: [[], [], [], [], [], [], []],
		score: 0,
		drawMode: 1,
		moves: 0,
		startTime: Date.now(),
		endTime: null,
		hintsUsed: 0,
		recycleCount: 0,
		mode: 'random',
		seed: 'test',
		dailyRestartCount: 0
	};
}

function card(suit: Suit, rank: Rank, faceUp = true) {
	return { id: `${suit}-${rank}`, suit, rank, faceUp };
}

function ranks(from: number, to: number): Rank[] {
	const out: Rank[] = [];
	for (let value = from; value <= to; value++) out.push(value as Rank);
	return out;
}

import type { Card, Suit, Rank } from './types';

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export function createDeck(): Card[] {
	const deck: Card[] = [];
	for (const suit of SUITS) {
		for (const rank of RANKS) {
			deck.push({ id: `${suit}-${rank}`, suit, rank, faceUp: false });
		}
	}
	return deck;
}

export function shuffle<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

export function suitSymbol(suit: Suit): string {
	return { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }[suit];
}

export function rankLabel(rank: Rank): string {
	if (rank === 1) return 'A';
	if (rank === 11) return 'J';
	if (rank === 12) return 'Q';
	if (rank === 13) return 'K';
	return String(rank);
}

export function cardColor(suit: Suit): 'red' | 'black' {
	return suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black';
}

// Pip positions for ranks 2-10 (grid: 4 cols 0-3, rows 0-4)
// Each pip is [col, row] where col 1 = left, col 2 = right; row 0..4
export type PipPos = [number, number, boolean]; // [x%, y%, flipped]
export function pipLayout(rank: Rank): PipPos[] {
	// x: 30 or 70 (%, left/right column); y: 15..85
	const L = 30, R = 70;
	const rows5 = [15, 32.5, 50, 67.5, 85];
	const rows4 = [20, 40, 60, 80];
	const rows3 = [20, 50, 80];

	switch (rank) {
		case 2: return [[50, rows3[0], false], [50, rows3[2], true]];
		case 3: return [[50, rows3[0], false], [50, rows3[1], false], [50, rows3[2], true]];
		case 4: return [[L, rows4[0], false], [R, rows4[0], false], [L, rows4[3], true], [R, rows4[3], true]];
		case 5: return [[L, rows4[0], false], [R, rows4[0], false], [50, 50, false], [L, rows4[3], true], [R, rows4[3], true]];
		case 6: return [[L, rows3[0], false], [R, rows3[0], false], [L, rows3[1], false], [R, rows3[1], false], [L, rows3[2], true], [R, rows3[2], true]];
		case 7: return [[L, rows3[0], false], [R, rows3[0], false], [L, rows3[1], false], [R, rows3[1], false], [50, 32.5, false], [L, rows3[2], true], [R, rows3[2], true]];
		case 8: return [[L, rows5[0], false], [R, rows5[0], false], [L, rows5[1], false], [R, rows5[1], false], [50, 50, false], [L, rows5[3], true], [R, rows5[3], true], [50, 67.5, true]];
		case 9: return [[L, rows5[0], false], [R, rows5[0], false], [L, rows5[1], false], [R, rows5[1], false], [50, 50, false], [L, rows5[3], true], [R, rows5[3], true], [L, rows5[4], true], [R, rows5[4], true]];
		case 10: return [[L, rows5[0], false], [R, rows5[0], false], [L, rows5[1], false], [R, rows5[1], false], [50, 27, false], [50, 73, true], [L, rows5[3], true], [R, rows5[3], true], [L, rows5[4], true], [R, rows5[4], true]];
		default: return [];
	}
}

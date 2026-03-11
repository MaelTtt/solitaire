import type { Suit, Rank } from './types';

// Sprite sheet: 13 cols (2→A) × 4 rows (hearts, spades, diamonds, clubs)
// Each cell: 142 × 190px, total: 1846 × 760px

const COL: Record<Rank, number> = {
	2: 0, 3: 1, 4: 2, 5: 3, 6: 4, 7: 5, 8: 6,
	9: 7, 10: 8, 11: 9, 12: 10, 13: 11, 1: 12
};

const ROW: Record<Suit, number> = {
	hearts: 0,
	spades: 1,
	diamonds: 2,
	clubs: 3
};

export function spriteStyle(suit: Suit, rank: Rank): string {
	const col = COL[rank];
	const row = ROW[suit];
	return [
		`background-image: url('/cards.png'), url('/card-back.png')`,
		`background-size: calc(13 * var(--card-w, 80px)) calc(4 * var(--card-h, 112px)), cover`,
		`background-position: calc(${-col} * var(--card-w, 80px)) calc(${-row} * var(--card-h, 112px)), center`
	].join(';');
}

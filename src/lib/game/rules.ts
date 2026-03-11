import type { Card, GameState } from './types';
import { cardColor } from './deck';

export function canMoveToTableau(card: Card, pile: Card[]): boolean {
	if (pile.length === 0) return card.rank === 13; // only King on empty
	const top = pile[pile.length - 1];
	if (!top.faceUp) return false;
	return cardColor(card.suit) !== cardColor(top.suit) && card.rank === top.rank - 1;
}

export function canMoveToFoundation(card: Card, pile: Card[]): boolean {
	if (pile.length === 0) return card.rank === 1; // only Ace starts
	const top = pile[pile.length - 1];
	return card.suit === top.suit && card.rank === top.rank + 1;
}

export function isWon(state: GameState): boolean {
	return state.foundations.every((f) => f.length === 13);
}

export function hasNoFaceDownCards(state: GameState): boolean {
	return state.tableau.every((pile) => pile.every((c) => c.faceUp));
}

// Returns the tableau index where a card sequence starting at `cards[0]` can go
export function findTableauMoves(cards: Card[], state: GameState): number[] {
	const results: number[] = [];
	for (let i = 0; i < 7; i++) {
		if (canMoveToTableau(cards[0], state.tableau[i])) {
			results.push(i);
		}
	}
	return results;
}

export function findFoundationIndex(card: Card, state: GameState): number {
	for (let i = 0; i < 4; i++) {
		if (canMoveToFoundation(card, state.foundations[i])) return i;
	}
	return -1;
}

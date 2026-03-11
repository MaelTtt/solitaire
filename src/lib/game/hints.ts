import type { GameState, PileLocation } from './types';
import { canMoveToFoundation, canMoveToTableau } from './rules';

export interface Hint {
	from: PileLocation;
	to: PileLocation;
	cardId: string;
}

export function hasAnyMove(state: GameState): boolean {
	return getHint(state) !== null;
}

export function getHint(state: GameState): Hint | null {
	// Priority 1: move to foundation
	for (let i = 0; i < 7; i++) {
		const pile = state.tableau[i];
		if (pile.length === 0) continue;
		const card = pile[pile.length - 1];
		if (!card.faceUp) continue;
		for (let f = 0; f < 4; f++) {
			if (canMoveToFoundation(card, state.foundations[f])) {
				return { from: { type: 'tableau', index: i }, to: { type: 'foundation', index: f }, cardId: card.id };
			}
		}
	}
	// Waste to foundation
	if (state.waste.length > 0) {
		const card = state.waste[state.waste.length - 1];
		for (let f = 0; f < 4; f++) {
			if (canMoveToFoundation(card, state.foundations[f])) {
				return { from: { type: 'waste', index: 0 }, to: { type: 'foundation', index: f }, cardId: card.id };
			}
		}
	}

	// Priority 2: reveal face-down (move face-up sequence off a pile that has face-down cards)
	for (let i = 0; i < 7; i++) {
		const pile = state.tableau[i];
		const firstFaceUp = pile.findIndex((c) => c.faceUp);
		if (firstFaceUp <= 0) continue; // no face-down cards below, or empty
		const movingCards = pile.slice(firstFaceUp);
		for (let j = 0; j < 7; j++) {
			if (j === i) continue;
			if (canMoveToTableau(movingCards[0], state.tableau[j])) {
				return { from: { type: 'tableau', index: i }, to: { type: 'tableau', index: j }, cardId: movingCards[0].id };
			}
		}
	}

	// Priority 3: waste to tableau
	if (state.waste.length > 0) {
		const card = state.waste[state.waste.length - 1];
		for (let j = 0; j < 7; j++) {
			if (canMoveToTableau(card, state.tableau[j])) {
				return { from: { type: 'waste', index: 0 }, to: { type: 'tableau', index: j }, cardId: card.id };
			}
		}
	}

	// Priority 4: tableau to tableau
	for (let i = 0; i < 7; i++) {
		const pile = state.tableau[i];
		const firstFaceUp = pile.findIndex((c) => c.faceUp);
		if (firstFaceUp < 0) continue;
		const movingCards = pile.slice(firstFaceUp);
		for (let j = 0; j < 7; j++) {
			if (j === i) continue;
			if (canMoveToTableau(movingCards[0], state.tableau[j])) {
				// Avoid moving a lone King to another empty pile (useless)
				if (movingCards[0].rank === 13 && state.tableau[j].length === 0 && firstFaceUp === 0) continue;
				return { from: { type: 'tableau', index: i }, to: { type: 'tableau', index: j }, cardId: movingCards[0].id };
			}
		}
	}

	// Priority 5: suggest drawing from stock
	if (state.stock.length > 0 || state.waste.length > 0) {
		return { from: { type: 'stock', index: 0 }, to: { type: 'stock', index: 0 }, cardId: '' };
	}

	return null;
}

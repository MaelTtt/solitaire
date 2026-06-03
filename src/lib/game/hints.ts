import type { Card, GameState, PileLocation } from './types';
import { canMoveToFoundation, canMoveToTableau, findFoundationIndex, hasNoFaceDownCards, isWon } from './rules';

export interface Hint {
	from: PileLocation;
	to: PileLocation;
	cardId: string;
	priority: number;
	message: string;
	kind: 'foundation' | 'reveal' | 'waste-tableau' | 'tableau' | 'stock';
}

export function hasAnyMove(state: GameState): boolean {
	return enumerateLegalMoves(state).length > 0;
}

export function hasAnyBoardMove(state: GameState): boolean {
	return enumerateLegalMoves(state, false).length > 0;
}

export function getHint(state: GameState): Hint | null {
	return enumerateLegalMoves(state).find((move) => isHelpfulHint(move)) ?? null;
}

export function enumerateLegalMoves(state: GameState, includeStock = true): Hint[] {
	const moves: Hint[] = [];

	// Move exposed cards to foundations.
	for (let i = 0; i < 7; i++) {
		const pile = state.tableau[i];
		if (pile.length === 0) continue;
		const card = pile[pile.length - 1];
		if (!card.faceUp) continue;
		for (let f = 0; f < 4; f++) {
			if (canMoveToFoundation(card, state.foundations[f])) {
				moves.push({
					from: { type: 'tableau', index: i },
					to: { type: 'foundation', index: f },
					cardId: card.id,
					priority: 100,
					kind: 'foundation',
					message: `Move ${cardLabel(card)} to a foundation.`
				});
			}
		}
	}

	if (state.waste.length > 0) {
		const card = state.waste[state.waste.length - 1];
		for (let f = 0; f < 4; f++) {
			if (canMoveToFoundation(card, state.foundations[f])) {
				moves.push({
					from: { type: 'waste', index: 0 },
					to: { type: 'foundation', index: f },
					cardId: card.id,
					priority: 98,
					kind: 'foundation',
					message: `Move ${cardLabel(card)} from the waste to a foundation.`
				});
			}
		}
	}

	// Tableau moves: inspect every face-up start, not only the first face-up card.
	for (let i = 0; i < 7; i++) {
		const pile = state.tableau[i];
		for (let start = 0; start < pile.length; start++) {
			const card = pile[start];
			if (!card.faceUp) continue;
			const revealsFaceDown = start > 0 && !pile[start - 1].faceUp;
			for (let j = 0; j < 7; j++) {
				if (j === i) continue;
				if (!canMoveToTableau(card, state.tableau[j])) continue;
				if (card.rank === 13 && state.tableau[j].length === 0 && !revealsFaceDown) continue;
				moves.push({
					from: { type: 'tableau', index: i },
					to: { type: 'tableau', index: j },
					cardId: card.id,
					priority: revealsFaceDown ? 92 : state.tableau[j].length === 0 ? 58 : 72,
					kind: revealsFaceDown ? 'reveal' : 'tableau',
					message: revealsFaceDown
						? `Move ${cardLabel(card)} to reveal a hidden card.`
						: `Move ${cardLabel(card)} to column ${j + 1}.`
				});
			}
		}
	}

	if (state.waste.length > 0) {
		const card = state.waste[state.waste.length - 1];
		for (let j = 0; j < 7; j++) {
			if (canMoveToTableau(card, state.tableau[j])) {
				moves.push({
					from: { type: 'waste', index: 0 },
					to: { type: 'tableau', index: j },
					cardId: card.id,
					priority: state.tableau[j].length === 0 ? 64 : 82,
					kind: 'waste-tableau',
					message: `Move ${cardLabel(card)} from the waste to column ${j + 1}.`
				});
			}
		}
	}

	if (includeStock && (state.stock.length > 0 || state.waste.length > 0)) {
		moves.push({
			from: { type: 'stock', index: 0 },
			to: { type: 'stock', index: 0 },
			cardId: '',
			priority: 10,
			kind: 'stock',
			message: state.stock.length > 0 ? 'Draw from the stock.' : 'Recycle the waste pile.'
		});
	}

	return dedupeMoves(moves).sort((a, b) => b.priority - a.priority);
}

export function canAutoComplete(state: GameState): boolean {
	if (!hasNoFaceDownCards(state)) return false;
	const probe = cloneState(state);
	const seen = new Set<string>();
	let guard = 0;

	while (guard++ < 500) {
		if (isWon(probe)) return true;
		const key = compactStateKey(probe);
		if (seen.has(key)) return false;
		seen.add(key);

		let moved = moveOneToFoundation(probe);
		if (moved) continue;

		if (probe.stock.length > 0) {
			const count = Math.min(probe.drawMode, probe.stock.length);
			const drawn = probe.stock.splice(probe.stock.length - count, count);
			drawn.forEach((card) => (card.faceUp = true));
			probe.waste.push(...drawn);
			continue;
		}

		if (probe.waste.length > 0) {
			probe.stock = probe.waste.reverse().map((card) => ({ ...card, faceUp: false }));
			probe.waste = [];
			probe.recycleCount++;
			continue;
		}

		return false;
	}

	return false;
}

function moveOneToFoundation(state: GameState): boolean {
	if (state.waste.length > 0) {
		const card = state.waste[state.waste.length - 1];
		const foundation = findFoundationIndex(card, state);
		if (foundation >= 0) {
			state.waste.pop();
			state.foundations[foundation].push(card);
			return true;
		}
	}

	for (let i = 0; i < 7; i++) {
		const pile = state.tableau[i];
		const card = pile[pile.length - 1];
		if (!card?.faceUp) continue;
		const foundation = findFoundationIndex(card, state);
		if (foundation >= 0) {
			pile.pop();
			state.foundations[foundation].push(card);
			return true;
		}
	}

	return false;
}

function dedupeMoves(moves: Hint[]): Hint[] {
	const seen = new Set<string>();
	return moves.filter((move) => {
		const key = `${move.from.type}:${move.from.index}:${move.to.type}:${move.to.index}:${move.cardId}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function isHelpfulHint(move: Hint): boolean {
	return move.kind !== 'tableau';
}

function cloneState(state: GameState): GameState {
	return {
		...state,
		stock: state.stock.map((card) => ({ ...card })),
		waste: state.waste.map((card) => ({ ...card })),
		foundations: state.foundations.map((pile) => pile.map((card) => ({ ...card }))) as GameState['foundations'],
		tableau: state.tableau.map((pile) => pile.map((card) => ({ ...card }))) as GameState['tableau']
	};
}

function compactStateKey(state: GameState): string {
	const enc = (cards: Card[]) => cards.map((card) => `${card.suit[0]}${card.rank}${card.faceUp ? 'u' : 'd'}`).join(',');
	return [
		enc(state.stock),
		enc(state.waste),
		state.foundations.map((pile) => pile.length).join(','),
		state.tableau.map(enc).join('|')
	].join('/');
}

function cardLabel(card: Card): string {
	const rank = card.rank === 1 ? 'A' : card.rank === 11 ? 'J' : card.rank === 12 ? 'Q' : card.rank === 13 ? 'K' : String(card.rank);
	const suit = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }[card.suit];
	return `${rank}${suit}`;
}

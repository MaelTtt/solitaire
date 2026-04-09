import { createDeck } from './deck';
import type { Card, GameMode, GameState, PileLocation } from './types';
import { canMoveToFoundation, canMoveToTableau, findFoundationIndex, hasNoFaceDownCards, isWon } from './rules';
import { seededShuffle } from './seedRng';

type Tableau = GameState['tableau'];
type Foundations = GameState['foundations'];

export interface SolvabilityResult {
	solved: boolean;
	moveCount: number;
	branchCount: number;
	score: number;
}

interface SearchState {
	stock: Card[];
	waste: Card[];
	foundations: Foundations;
	tableau: Tableau;
	drawMode: 1 | 3;
	recycleCount: number;
}

interface Move {
	from: PileLocation;
	to: PileLocation;
	cardId?: string;
	priority: number;
}

const MAX_CANDIDATE_ATTEMPTS = 14;
const MAX_FRONTIER_SIZE = 28;
const MAX_DEPTH = 110;
const MAX_VISITED_STATES = 4500;

export function dealSolvableState(drawMode: 1 | 3 = 1, mode: GameMode = 'random', seed = ''): GameState {
	const raw = createDeck();
	const baseSeed = seed || randomSeed();
	let bestState: GameState | null = null;
	let bestResult: SolvabilityResult | null = null;
	for (let attempt = 0; attempt < MAX_CANDIDATE_ATTEMPTS; attempt++) {
		const attemptSeed = `${baseSeed}#${attempt}`;
		const deck = seededShuffle(raw, attemptSeed);
		const state = dealFromDeck(deck, drawMode, mode, seed || attemptSeed);
		const result = solveKlondike(state);
		if (
			!bestResult ||
			result.score > bestResult.score ||
			(result.score === bestResult.score && result.branchCount > bestResult.branchCount)
		) {
			bestResult = result;
			bestState = state;
		}
		if (result.solved && result.branchCount >= 7) {
			return state;
		}
	}
	if (bestState) return bestState;
	const fallbackDeck = seededShuffle(raw, `${baseSeed}#0`);
	return dealFromDeck(fallbackDeck, drawMode, mode, seed || `${baseSeed}#0`);
}

export function solveKlondike(initial: GameState): SolvabilityResult {
	const start = cloneSearchState(initial);
	const visited = new Set<string>();
	let frontier: Array<{ state: SearchState; depth: number; score: number }> = [{ state: start, depth: 0, score: evaluateState(start) }];
	let bestScore = frontier[0].score;
	let bestDepth = 0;
	let branchCount = getCandidateMoves(start).length;

	for (let depth = 0; depth < MAX_DEPTH && frontier.length > 0 && visited.size < MAX_VISITED_STATES; depth++) {
		const nextLayer: Array<{ state: SearchState; depth: number; score: number }> = [];

		for (const entry of frontier) {
			const key = serializeState(entry.state);
			if (visited.has(key)) continue;
			visited.add(key);

			if (isWon(entry.state as GameState)) {
				return { solved: true, moveCount: entry.depth, branchCount, score: 100000 - entry.depth };
			}

			const moves = getCandidateMoves(entry.state);
			if (moves.length > 1) branchCount += Math.min(3, moves.length - 1);
			for (const move of moves.slice(0, 5)) {
				const next = applyMove(entry.state, move);
				if (!next) continue;
				const nextScore = evaluateState(next);
				bestScore = Math.max(bestScore, nextScore);
				if (nextScore === bestScore) bestDepth = entry.depth + 1;
				nextLayer.push({ state: next, depth: entry.depth + 1, score: nextScore });
			}
		}

		nextLayer.sort((a, b) => b.score - a.score);
		frontier = pruneFrontier(nextLayer, visited);
	}

	return { solved: false, moveCount: bestDepth, branchCount, score: bestScore };
}

function randomSeed() {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function dealFromDeck(deck: Card[], drawMode: 1 | 3, mode: GameMode, seed: string): GameState {
	const tableau: Tableau = [[], [], [], [], [], [], []];
	let idx = 0;
	for (let col = 0; col < 7; col++) {
		for (let row = 0; row <= col; row++) {
			const card = { ...deck[idx++] };
			card.faceUp = row === col;
			tableau[col].push(card);
		}
	}
	return {
		stock: deck.slice(idx).map((c) => ({ ...c, faceUp: false })),
		waste: [],
		foundations: [[], [], [], []],
		tableau,
		score: 0,
		drawMode,
		moves: 0,
		startTime: Date.now(),
		endTime: null,
		hintsUsed: 0,
		recycleCount: 0,
		mode,
		seed
	};
}

function cloneSearchState(state: Pick<GameState, 'stock' | 'waste' | 'foundations' | 'tableau' | 'drawMode' | 'recycleCount'>): SearchState {
	return {
		stock: state.stock.map(cloneCard),
		waste: state.waste.map(cloneCard),
		foundations: state.foundations.map((pile) => pile.map(cloneCard)) as Foundations,
		tableau: state.tableau.map((pile) => pile.map(cloneCard)) as Tableau,
		drawMode: state.drawMode,
		recycleCount: state.recycleCount
	};
}

function cloneCard(card: Card): Card {
	return { ...card };
}

function evaluateState(state: SearchState): number {
	const foundationCards = state.foundations.reduce((sum, pile) => sum + pile.length, 0);
	const faceUpCards = state.tableau.reduce((sum, pile) => sum + pile.filter((card) => card.faceUp).length, 0);
	const hiddenCards = state.tableau.reduce((sum, pile) => sum + pile.filter((card) => !card.faceUp).length, 0);
	const emptyColumns = state.tableau.filter((pile) => pile.length === 0).length;
	const tableauMoves = state.tableau.reduce((sum, pile, index) => {
		if (pile.length === 0) return sum;
		const firstFaceUp = pile.findIndex((card) => card.faceUp);
		if (firstFaceUp < 0) return sum;
		const card = pile[firstFaceUp];
		let moves = 0;
		for (let target = 0; target < state.tableau.length; target++) {
			if (target !== index && canMoveToTableau(card, state.tableau[target])) moves++;
		}
		return sum + moves;
	}, 0);
	return foundationCards * 90 + faceUpCards * 8 + tableauMoves * 6 + emptyColumns * 12 - hiddenCards * 5 - state.recycleCount * 10;
}

function pruneFrontier(
	frontier: Array<{ state: SearchState; depth: number; score: number }>,
	visited: Set<string>
): Array<{ state: SearchState; depth: number; score: number }> {
	const kept: Array<{ state: SearchState; depth: number; score: number }> = [];
	const seen = new Set<string>();
	for (const entry of frontier) {
		const key = serializeState(entry.state);
		if (visited.has(key) || seen.has(key)) continue;
		seen.add(key);
		kept.push(entry);
		if (kept.length >= MAX_FRONTIER_SIZE) break;
	}
	return kept;
}

function serializeState(state: SearchState): string {
	return JSON.stringify({
		s: state.stock.map((c) => `${c.id}:${c.faceUp ? 1 : 0}`),
		w: state.waste.map((c) => c.id),
		f: state.foundations.map((pile) => pile.map((c) => c.id)),
		t: state.tableau.map((pile) => pile.map((c) => `${c.id}:${c.faceUp ? 1 : 0}`)),
		r: state.recycleCount
	});
}

function getCandidateMoves(state: SearchState): Move[] {
	const moves: Move[] = [];

	if (state.waste.length > 0) {
		const wasteCard = state.waste[state.waste.length - 1];
		const foundationIndex = findFoundationIndex(wasteCard, state as GameState);
		if (foundationIndex >= 0) {
			moves.push({ from: { type: 'waste', index: 0 }, to: { type: 'foundation', index: foundationIndex }, priority: 100 });
		}
		for (let i = 0; i < 7; i++) {
			if (canMoveToTableau(wasteCard, state.tableau[i])) {
				moves.push({ from: { type: 'waste', index: 0 }, to: { type: 'tableau', index: i }, priority: state.tableau[i].length === 0 ? 55 : 75 });
			}
		}
	}

	for (let i = 0; i < 7; i++) {
		const pile = state.tableau[i];
		if (pile.length === 0) continue;

		const topCard = pile[pile.length - 1];
		if (topCard.faceUp) {
			const foundationIndex = findFoundationIndex(topCard, state as GameState);
			if (foundationIndex >= 0 && canSafelyMoveToFoundation(topCard, state)) {
				moves.push({ from: { type: 'tableau', index: i }, to: { type: 'foundation', index: foundationIndex }, priority: 95 });
			}
		}

		for (let start = 0; start < pile.length; start++) {
			if (!pile[start].faceUp) continue;
			const moving = pile.slice(start);
			for (let j = 0; j < 7; j++) {
				if (i === j) continue;
				if (!canMoveToTableau(moving[0], state.tableau[j])) continue;
				const revealsFaceDown = start > 0 && !pile[start - 1].faceUp;
				const priority = revealsFaceDown ? 90 : state.tableau[j].length === 0 ? 45 : 70;
				if (moving[0].rank === 13 && state.tableau[j].length === 0 && !revealsFaceDown) continue;
				moves.push({ from: { type: 'tableau', index: i }, to: { type: 'tableau', index: j }, cardId: moving[0].id, priority });
			}
		}
	}

	if (state.stock.length > 0) {
		moves.push({ from: { type: 'stock', index: 0 }, to: { type: 'stock', index: 0 }, priority: 10 });
	} else if (state.waste.length > 0 && state.recycleCount < 2 && !hasNoFaceDownCards(state as GameState)) {
		moves.push({ from: { type: 'stock', index: 0 }, to: { type: 'stock', index: 0 }, priority: 5 });
	}

	return dedupeMoves(moves).sort((a, b) => b.priority - a.priority);
}

function dedupeMoves(moves: Move[]): Move[] {
	const seen = new Set<string>();
	return moves.filter((move) => {
		const key = `${move.from.type}:${move.from.index}:${move.to.type}:${move.to.index}:${move.cardId ?? ''}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function canSafelyMoveToFoundation(card: Card, state: SearchState): boolean {
	if (card.rank <= 2) return true;
	const oppositeColorSuits = card.suit === 'hearts' || card.suit === 'diamonds' ? ['spades', 'clubs'] : ['hearts', 'diamonds'];
	const requiredRank = card.rank - 1;
	return oppositeColorSuits.every((suit) => {
		const foundation = state.foundations.find((pile) => pile[pile.length - 1]?.suit === suit);
		const topRank = foundation?.[foundation.length - 1]?.rank ?? 0;
		return topRank >= requiredRank;
	});
}

function applyMove(state: SearchState, move: Move): SearchState | null {
	const next = cloneSearchState(state);

	if (move.from.type === 'stock') {
		if (next.stock.length === 0) {
			next.stock = next.waste.reverse().map((c) => ({ ...c, faceUp: false }));
			next.waste = [];
			next.recycleCount++;
			return next;
		}
		const count = Math.min(next.drawMode, next.stock.length);
		const drawn = next.stock.splice(next.stock.length - count, count);
		drawn.forEach((c) => (c.faceUp = true));
		next.waste.push(...drawn);
		return next;
	}

	const cards = takeCards(next, move.from, move.cardId);
	if (!cards.length) return null;
	const dest = getPile(next, move.to);
	if (move.to.type === 'foundation') {
		if (cards.length !== 1 || !canMoveToFoundation(cards[0], dest)) return null;
	} else if (move.to.type === 'tableau') {
		if (!canMoveToTableau(cards[0], dest)) return null;
	} else {
		return null;
	}
	dest.push(...cards);

	if (move.from.type === 'tableau') {
		const source = next.tableau[move.from.index];
		if (source.length > 0 && !source[source.length - 1].faceUp) {
			source[source.length - 1].faceUp = true;
		}
	}
	return next;
}

function getPile(state: SearchState, loc: PileLocation): Card[] {
	if (loc.type === 'stock') return state.stock;
	if (loc.type === 'waste') return state.waste;
	if (loc.type === 'foundation') return state.foundations[loc.index];
	return state.tableau[loc.index];
}

function takeCards(state: SearchState, loc: PileLocation, cardId?: string): Card[] {
	if (loc.type === 'waste') {
		const card = state.waste.pop();
		return card ? [card] : [];
	}
	if (loc.type === 'foundation') {
		const card = state.foundations[loc.index].pop();
		return card ? [card] : [];
	}
	if (loc.type === 'tableau') {
		const pile = state.tableau[loc.index];
		if (!cardId) {
			const firstFaceUp = pile.findIndex((card) => card.faceUp);
			return firstFaceUp >= 0 ? pile.splice(firstFaceUp) : [];
		}
		const index = pile.findIndex((card) => card.id === cardId);
		return index >= 0 ? pile.splice(index) : [];
	}
	return [];
}

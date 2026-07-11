import { createDeck } from './deck';
import type { Card, GameMode, GameState, PileLocation } from './types';
import { canMoveToFoundation, canMoveToTableau, findFoundationIndex, isWon } from './rules';
import { seededShuffle } from './seedRng';

type Tableau = GameState['tableau'];
type Foundations = GameState['foundations'];

export interface SolvabilityResult {
	solved: boolean;
	moveCount: number;
	branchCount: number;
	score: number;
	exploredStates: number;
}

export interface SolverOptions {
	maxDepth?: number;
	maxVisitedStates?: number;
}

export interface VerifiedSeedResult {
	seed: string;
	difficulty: number;
	solutionMoves: number;
	exploredStates: number;
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
	viaIndex?: number;
	priority: number;
}

interface SearchEntry {
	state: SearchState;
	depth: number;
}

const CERTIFIED_V1_SEED_PREFIX = 'certified:';
const CERTIFIED_V2_SEED_PREFIX = 'certified-v2:';
const VERIFIED_V3_SEED_PREFIX = 'verified-v3:';
const MAX_DEPTH = 260;
const MAX_VISITED_STATES = 250000;

export function dealSeededState(drawMode: 1 | 3 = 1, mode: GameMode = 'random', seed = ''): GameState {
	const exactSeed = seed || randomSeed();
	if (exactSeed.startsWith(VERIFIED_V3_SEED_PREFIX)) {
		const shuffleSeed = exactSeed.slice(VERIFIED_V3_SEED_PREFIX.length);
		return dealFromDeck(seededShuffle(createDeck(), shuffleSeed), drawMode, mode, exactSeed);
	}
	if (exactSeed.startsWith(CERTIFIED_V2_SEED_PREFIX)) {
		return dealCertifiedV2State(exactSeed.slice(CERTIFIED_V2_SEED_PREFIX.length), drawMode, mode, exactSeed);
	}
	if (exactSeed.startsWith(CERTIFIED_V1_SEED_PREFIX)) {
		return dealCertifiedV1State(exactSeed.slice(CERTIFIED_V1_SEED_PREFIX.length), drawMode, mode, exactSeed);
	}
	return dealFromDeck(seededShuffle(createDeck(), exactSeed), drawMode, mode, exactSeed);
}

export function solveKlondike(initial: GameState, options: SolverOptions = {}): SolvabilityResult {
	const maxDepth = options.maxDepth ?? MAX_DEPTH;
	const maxVisitedStates = options.maxVisitedStates ?? MAX_VISITED_STATES;
	const start = cloneSearchState(initial);
	if (start.drawMode === 1 && start.waste.length > 0) {
		start.stock.push(...start.waste.map((card) => ({ ...card, faceUp: false })));
		start.waste = [];
	}
	const seen = new Map<string, number>([[serializeState(start), 0]]);
	const frontier: SearchEntry[] = [{ state: start, depth: 0 }];
	let bestScore = evaluateState(start);
	let bestDepth = 0;
	let branchCount = getCandidateMoves(start).length;
	let exploredStates = 0;

	while (frontier.length > 0 && exploredStates < maxVisitedStates) {
		const entry = frontier.pop()!;
		exploredStates++;
		if (isWon(entry.state as GameState)) {
			return {
				solved: true,
				moveCount: entry.depth,
				branchCount,
				score: 100000 - entry.depth,
				exploredStates
			};
		}
		if (entry.depth >= maxDepth) continue;

		const moves = getCandidateMoves(entry.state);
		if (moves.length > 1) branchCount += Math.min(3, moves.length - 1);
		for (let index = moves.length - 1; index >= 0; index--) {
			const move = moves[index];
			const next = applyMove(entry.state, move);
			if (!next) continue;
			const key = serializeState(next);
			const depth = entry.depth + 1;
			const previousDepth = seen.get(key);
			if (previousDepth !== undefined && previousDepth <= depth) continue;
			seen.set(key, depth);
			const nextScore = evaluateState(next);
			bestScore = Math.max(bestScore, nextScore);
			if (nextScore === bestScore) bestDepth = depth;
			frontier.push({ state: next, depth });
		}
	}

	return {
		solved: false,
		moveCount: bestDepth,
		branchCount,
		score: bestScore,
		exploredStates
	};
}

export function createCertifiedSeed(baseSeed: string): string {
	return `${CERTIFIED_V2_SEED_PREFIX}${baseSeed}`;
}

export function findVerifiedSeed(baseSeed: string, drawMode: 1 | 3 = 1, maxAttempts = 24): VerifiedSeedResult | null {
	let best: VerifiedSeedResult | null = null;

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const shuffleSeed = `${baseSeed}#${attempt}`;
		const seed = `${VERIFIED_V3_SEED_PREFIX}${shuffleSeed}`;
		const state = dealSeededState(drawMode, 'random', seed);
		const exposed = state.tableau.map((pile) => pile[pile.length - 1]);
		const lowCards = exposed.filter((card) => card.rank <= 4).length;
		const aces = exposed.filter((card) => card.rank === 1).length;
		if (aces === 0 && lowCards <= 2) {
			const result = solveKlondike(state, { maxVisitedStates: 10000 });
			if (result.solved) {
				const difficulty = Math.round(
					result.moveCount * 2 +
					Math.log2(result.exploredStates + 1) * 18 -
					lowCards * 12
				);
				const candidate = {
					seed,
					difficulty,
					solutionMoves: result.moveCount,
					exploredStates: result.exploredStates
				};
				if (!best || candidate.difficulty > best.difficulty) best = candidate;
			}
		}
		if (attempt >= 7 && best && best.exploredStates >= 500) break;
	}

	return best;
}

export function matchesSeedBase(seed: string, baseSeed: string): boolean {
	return seed === baseSeed ||
		seed.startsWith(`${baseSeed}#`) ||
		seed.startsWith(`${VERIFIED_V3_SEED_PREFIX}${baseSeed}#`);
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
		seed,
		dailyRestartCount: 0
	};
}

function dealCertifiedV1State(baseSeed: string, drawMode: 1 | 3, mode: GameMode, seed: string): GameState {
	return dealFromCertifiedPath(createV1FoundationPath(baseSeed), baseSeed, drawMode, mode, seed, 'layer');
}

function dealCertifiedV2State(baseSeed: string, drawMode: 1 | 3, mode: GameMode, seed: string): GameState {
	return dealFromCertifiedPath(createVariedFoundationPath(baseSeed), baseSeed, drawMode, mode, seed, 'tableau');
}

function createVariedFoundationPath(baseSeed: string): Card[] {
	const deck = createDeck();
	const nextRank = new Map<Card['suit'], number>([
		['spades', 1],
		['hearts', 1],
		['diamonds', 1],
		['clubs', 1]
	]);
	const path: Card[] = [];

	for (let step = 0; step < 52; step++) {
		const eligible = [...nextRank.entries()]
			.filter(([, rank]) => rank <= 13)
			.map(([suit]) => suit);
		const suit = seededShuffle(eligible, `${baseSeed}:path:${step}`)[0];
		const rank = nextRank.get(suit) ?? 1;
		path.push(deck.find((card) => card.suit === suit && card.rank === rank)!);
		nextRank.set(suit, rank + 1);
	}

	return path;
}

function dealFromCertifiedPath(
	foundationOrder: Card[],
	baseSeed: string,
	drawMode: 1 | 3,
	mode: GameMode,
	seed: string,
	tableauSeedPart: string
): GameState {
	const removalOrder = foundationOrder.slice(0, 28);
	const assigned: Card[][] = [[], [], [], [], [], [], []];
	let cardIndex = 0;
	for (let layer = 0; layer < 7; layer++) {
		const columns = seededShuffle(
			[0, 1, 2, 3, 4, 5, 6].filter((column) => column + 1 > layer),
			`${baseSeed}:${tableauSeedPart}:${layer}`
		);
		for (const column of columns) assigned[column].push(removalOrder[cardIndex++]);
	}

	const tableau = assigned.map((cards) => cards.reverse().map((card, index, pile) => ({
		...card,
		faceUp: index === pile.length - 1
	}))) as Tableau;
	const stock = foundationOrder.slice(28).reverse().map((card) => ({ ...card, faceUp: false }));

	return {
		stock,
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
		seed,
		dailyRestartCount: 0
	};
}

export function verifyCertifiedDeal(initial: GameState): boolean {
	const prefix = initial.seed.startsWith(CERTIFIED_V2_SEED_PREFIX)
		? CERTIFIED_V2_SEED_PREFIX
		: initial.seed.startsWith(CERTIFIED_V1_SEED_PREFIX)
			? CERTIFIED_V1_SEED_PREFIX
			: '';
	if (!prefix) return false;

	const baseSeed = initial.seed.slice(prefix.length);
	const path = prefix === CERTIFIED_V2_SEED_PREFIX
		? createVariedFoundationPath(baseSeed)
		: createV1FoundationPath(baseSeed);
	const state = cloneSearchState(initial);
	let pathIndex = 0;

	for (; pathIndex < 28; pathIndex++) {
		const expected = path[pathIndex];
		const column = state.tableau.findIndex((pile) => pile[pile.length - 1]?.id === expected.id);
		if (column < 0) return false;
		const card = state.tableau[column].pop();
		if (!card?.faceUp) return false;
		const foundationIndex = findFoundationIndex(card, state as GameState);
		if (foundationIndex < 0) return false;
		state.foundations[foundationIndex].push(card);
		const next = state.tableau[column][state.tableau[column].length - 1];
		if (next) next.faceUp = true;
	}

	while (state.stock.length > 0) {
		const count = Math.min(state.drawMode, state.stock.length);
		const drawn = state.stock.splice(state.stock.length - count, count);
		drawn.forEach((card) => (card.faceUp = true));
		state.waste.push(...drawn);

		for (let i = 0; i < count; i++, pathIndex++) {
			const expected = path[pathIndex];
			const card = state.waste.pop();
			if (!card || card.id !== expected.id) return false;
			const foundationIndex = findFoundationIndex(card, state as GameState);
			if (foundationIndex < 0) return false;
			state.foundations[foundationIndex].push(card);
		}
	}

	return pathIndex === 52 && state.waste.length === 0 && isWon(state as GameState);
}

function createV1FoundationPath(baseSeed: string): Card[] {
	const deck = createDeck();
	const path: Card[] = [];
	for (let rank = 1; rank <= 13; rank++) {
		path.push(...seededShuffle(deck.filter((card) => card.rank === rank), `${baseSeed}:rank:${rank}`));
	}
	return path;
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
	return foundationCards * 90 + faceUpCards * 8 + tableauMoves * 6 + emptyColumns * 12 - hiddenCards * 5;
}

function serializeState(state: SearchState): string {
	// Compact string key: faster than JSON.stringify, avoids object allocation
	// Each card encoded as 2 chars (suit index + rank), face-up bit appended for tableau/stock
	const SUIT_IDX: Record<string, string> = { spades: 'a', hearts: 'b', diamonds: 'c', clubs: 'd' };
	const enc = (c: Card, withFace = false) => SUIT_IDX[c.suit] + c.rank.toString(16) + (withFace ? (c.faceUp ? '1' : '0') : '');
	const s = state.drawMode === 1
		? state.stock.map(c => enc(c)).sort().join('')
		: state.stock.map(c => enc(c, true)).join('');
	const w = state.waste.map(c => enc(c)).join('');
	const f = state.foundations.map(p => p.length.toString(16)).join('');
	const t = state.tableau.map(p => p.map(c => enc(c, true)).join('')).sort().join('|');
	return `${f}:${w}:${s}:${t}`;
}

function getCandidateMoves(state: SearchState): Move[] {
	const moves: Move[] = [];

	if (state.drawMode === 1) {
		for (const deckCard of state.stock) {
			const foundationIndex = findFoundationIndex(deckCard, state as GameState);
			if (foundationIndex >= 0) {
				moves.push({
					from: { type: 'stock', index: 0 },
					to: { type: 'foundation', index: foundationIndex },
					cardId: deckCard.id,
					priority: canSafelyMoveToFoundation(deckCard, state) ? 100 : 60
				});
			}
			for (let i = 0; i < 7; i++) {
				if (canMoveToTableau(deckCard, state.tableau[i])) {
					moves.push({
						from: { type: 'stock', index: 0 },
						to: { type: 'tableau', index: i },
						cardId: deckCard.id,
						priority: state.tableau[i].length === 0 ? 55 : 76
					});
				}
			}
		}
	}

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

		for (let cardIndex = pile.length - 1; cardIndex >= 0 && pile[cardIndex].faceUp; cardIndex--) {
			const card = pile[cardIndex];
			const foundationIndex = findFoundationIndex(card, state as GameState);
			if (foundationIndex < 0) continue;
			const priority = canSafelyMoveToFoundation(card, state) ? 95 : 62;
			if (cardIndex === pile.length - 1) {
				moves.push({
					from: { type: 'tableau', index: i },
					to: { type: 'foundation', index: foundationIndex },
					cardId: card.id,
					priority
				});
				continue;
			}
			const coveringCard = pile[cardIndex + 1];
			for (let target = 0; target < 7; target++) {
				if (target === i || !canMoveToTableau(coveringCard, state.tableau[target])) continue;
				moves.push({
					from: { type: 'tableau', index: i },
					to: { type: 'foundation', index: foundationIndex },
					cardId: card.id,
					viaIndex: target,
					priority
				});
			}
		}

		const firstFaceUp = pile.findIndex((card) => card.faceUp);
		if (firstFaceUp > 0 && !pile[firstFaceUp - 1].faceUp) {
			const movingCard = pile[firstFaceUp];
			for (let j = 0; j < 7; j++) {
				if (i === j || !canMoveToTableau(movingCard, state.tableau[j])) continue;
				moves.push({
					from: { type: 'tableau', index: i },
					to: { type: 'tableau', index: j },
					cardId: movingCard.id,
					priority: 90
				});
			}
		}
	}

	for (let i = 0; i < 4; i++) {
		const card = state.foundations[i][state.foundations[i].length - 1];
		if (!card) continue;
		for (let j = 0; j < 7; j++) {
			if (canMoveToTableau(card, state.tableau[j])) {
				moves.push({ from: { type: 'foundation', index: i }, to: { type: 'tableau', index: j }, priority: 30 });
			}
		}
	}

	if (state.drawMode === 3 && state.stock.length > 0) {
		moves.push({ from: { type: 'stock', index: 0 }, to: { type: 'stock', index: 0 }, priority: 10 });
	} else if (state.drawMode === 3 && state.waste.length > 0) {
		moves.push({ from: { type: 'stock', index: 0 }, to: { type: 'stock', index: 0 }, priority: 5 });
	}

	const sorted = dedupeMoves(moves).sort((a, b) => b.priority - a.priority);
	const safeFoundationMoves = sorted.filter((move) => move.to.type === 'foundation' && move.priority >= 95);
	return safeFoundationMoves.length > 0 ? [safeFoundationMoves[0]] : sorted;
}

function dedupeMoves(moves: Move[]): Move[] {
	const seen = new Set<string>();
	return moves.filter((move) => {
		const key = `${move.from.type}:${move.from.index}:${move.to.type}:${move.to.index}:${move.cardId ?? ''}:${move.viaIndex ?? ''}`;
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
		if (move.to.type !== 'stock' && move.cardId) {
			const index = next.stock.findIndex((card) => card.id === move.cardId);
			if (index < 0) return null;
			const [card] = next.stock.splice(index, 1);
			card.faceUp = true;
			const dest = getPile(next, move.to);
			if (move.to.type === 'foundation') {
				if (!canMoveToFoundation(card, dest)) return null;
			} else if (move.to.type === 'tableau') {
				if (!canMoveToTableau(card, dest)) return null;
			} else {
				return null;
			}
			dest.push(card);
			return next;
		}
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

	if (move.from.type === 'tableau' && move.to.type === 'foundation' && move.cardId) {
		const source = next.tableau[move.from.index];
		const cardIndex = source.findIndex((card) => card.id === move.cardId);
		if (cardIndex < 0) return null;
		if (cardIndex < source.length - 1) {
			if (move.viaIndex === undefined) return null;
			const covering = source.splice(cardIndex + 1);
			const via = next.tableau[move.viaIndex];
			if (!canMoveToTableau(covering[0], via)) return null;
			via.push(...covering);
		}
		const [card] = source.splice(cardIndex, 1);
		const dest = next.foundations[move.to.index];
		if (!canMoveToFoundation(card, dest)) return null;
		dest.push(card);
		const sourceTop = source[source.length - 1];
		if (sourceTop && !sourceTop.faceUp) sourceTop.faceUp = true;
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



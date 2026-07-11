import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Card, GameMode, GameState, PileLocation } from '@/lib/game/types';
import { canMoveToFoundation, canMoveToTableau, findFoundationIndex, hasNoFaceDownCards, isWon } from '@/lib/game/rules';
import { canAutoComplete, getHint, hasAnyBoardMove, type Hint } from '@/lib/game/hints';
import {
	SCORE_FLIP,
	SCORE_FOUNDATION,
	SCORE_RECYCLE,
	SCORE_TABLEAU,
	SCORE_UNDO,
	SCORE_WASTE_TO_TABLEAU,
	timeBonus
} from '@/lib/game/score';
import { dealSeededState, matchesSeedBase } from '@/lib/game/solver';
import { todaySeed } from '@/lib/game/seedRng';

const MAX_UNDO = 100;
const SAVE_KEY = 'klondike-save';

interface SavedGame {
	state: GameState;
	won: boolean;
	stuck: boolean;
	saveTime: number;
}

interface InitialGame {
	state: GameState;
	won: boolean;
	stuck: boolean;
	loaded: boolean;
}

export interface GameController {
	state: GameState;
	undoStack: GameState[];
	hint: Hint | null;
	autoCompleting: boolean;
	won: boolean;
	stuck: boolean;
	loadedSaved: boolean;
	newGame: (drawMode?: 1 | 3, mode?: GameMode, seed?: string, dailyRestartCount?: number) => void;
	drawFromStock: () => boolean;
	moveCards: (from: PileLocation, to: PileLocation, startCardId?: string) => boolean;
	autoMoveToFoundation: (from: PileLocation) => boolean;
	showHint: () => void;
	undo: () => void;
	clearSaved: () => void;
	getFinalScore: () => number;
}

export function useGame(): GameController {
	const initial = useMemo(loadInitialGame, []);
	const [state, setState] = useState<GameState>(initial.state);
	const [undoStack, setUndoStack] = useState<GameState[]>([]);
	const [hint, setHint] = useState<Hint | null>(null);
	const [autoCompleting, setAutoCompleting] = useState(false);
	const [won, setWon] = useState(initial.won);
	const [stuck, setStuck] = useState(initial.stuck);

	const stateRef = useRef(state);
	const undoRef = useRef<GameState[]>([]);
	const wonRef = useRef(initial.won);
	const autoRef = useRef(false);
	const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const setGameState = (next: GameState) => {
		stateRef.current = next;
		setState(next);
		saveGame(next, wonRef.current, false);
	};

	const pushUndo = (snapshot: GameState) => {
		const next = [...undoRef.current.slice(-MAX_UNDO + 1), cloneGameState(snapshot)];
		undoRef.current = next;
		setUndoStack(next);
	};

	const finishState = (next: GameState) => {
		if (isWon(next)) {
			next.endTime = next.endTime ?? Date.now();
			wonRef.current = true;
			setWon(true);
			setStuck(false);
			stopAutoComplete();
			return;
		}

		if (!autoRef.current && canAutoComplete(next)) {
			startAutoComplete();
			setStuck(false);
			return;
		}

		setStuck(!hasAnyBoardMove(next) && next.stock.length === 0 && next.waste.length === 0);
	};

	const stopAutoComplete = () => {
		if (autoTimer.current) clearTimeout(autoTimer.current);
		autoTimer.current = null;
		autoRef.current = false;
		setAutoCompleting(false);
	};

	const startAutoComplete = () => {
		if (autoRef.current) return;
		autoRef.current = true;
		setAutoCompleting(true);
		autoTimer.current = setTimeout(autoCompleteStep, 70);
	};

	const autoCompleteStep = () => {
		const current = stateRef.current;
		if (wonRef.current || !autoRef.current) return;

		const next = cloneGameState(current);
		let progressed = moveOneCardToFoundation(next);

		if (!progressed && hasNoFaceDownCards(next)) {
			if (next.stock.length > 0) {
				const count = Math.min(next.drawMode, next.stock.length);
				const drawn = next.stock.splice(next.stock.length - count, count);
				drawn.forEach((card) => (card.faceUp = true));
				next.waste.push(...drawn);
				progressed = true;
			} else if (next.waste.length > 0) {
				next.stock = next.waste.reverse().map((card) => ({ ...card, faceUp: false }));
				next.waste = [];
				next.recycleCount++;
				progressed = true;
			}
		}

		if (!progressed) {
			stopAutoComplete();
			finishState(current);
			return;
		}

		if (isWon(next)) {
			next.endTime = Date.now();
			wonRef.current = true;
			setWon(true);
			setStuck(false);
			setGameState(next);
			stopAutoComplete();
			return;
		}

		setGameState(next);
		autoTimer.current = setTimeout(autoCompleteStep, 70);
	};

	useEffect(() => () => {
		if (hintTimer.current) clearTimeout(hintTimer.current);
		if (autoTimer.current) clearTimeout(autoTimer.current);
	}, []);

	return {
		state,
		undoStack,
		hint,
		autoCompleting,
		won,
		stuck,
		loadedSaved: initial.loaded,

		newGame(drawMode = stateRef.current.drawMode, mode = 'random', seed = '', dailyRestartCount = 0) {
			stopAutoComplete();
			const next = dealState(drawMode, mode, seed, dailyRestartCount);
			stateRef.current = next;
			undoRef.current = [];
			wonRef.current = false;
			setState(next);
			setUndoStack([]);
			setHint(null);
			setWon(false);
			setStuck(false);
			saveGame(next, false, false);
		},

		drawFromStock() {
			const current = stateRef.current;
			if (wonRef.current || autoRef.current) return false;
			const next = cloneGameState(current);
			if (next.stock.length === 0) {
				if (next.waste.length === 0) return false;
				next.recycleCount++;
				next.stock = next.waste.reverse().map((card) => ({ ...card, faceUp: false }));
				next.waste = [];
				if (next.drawMode === 3) next.score += SCORE_RECYCLE;
			} else {
				const count = Math.min(next.drawMode, next.stock.length);
				const drawn = next.stock.splice(next.stock.length - count, count);
				drawn.forEach((card) => (card.faceUp = true));
				next.waste.push(...drawn);
				next.moves++;
			}
			pushUndo(current);
			finishState(next);
			setGameState(next);
			return true;
		},

		moveCards(from: PileLocation, to: PileLocation, startCardId?: string) {
			const current = stateRef.current;
			if (wonRef.current || autoRef.current) return false;
			const next = cloneGameState(current);
			const cards = startCardId ? takeFromAt(next, from, startCardId) : takeFrom(next, from);
			if (cards.length === 0) return false;

			const destination = getPile(next, to);
			const topCard = cards[0];
			const valid = to.type === 'foundation'
				? cards.length === 1 && canMoveToFoundation(topCard, destination)
				: to.type === 'tableau' && canMoveToTableau(topCard, destination);

			if (!valid) return false;

			destination.push(...cards);
			next.moves++;
			if (to.type === 'foundation') next.score += SCORE_FOUNDATION;
			if (to.type === 'tableau') next.score += from.type === 'waste' ? SCORE_WASTE_TO_TABLEAU : SCORE_TABLEAU;

			if (from.type === 'tableau') {
				const source = next.tableau[from.index];
				const card = source[source.length - 1];
				if (card && !card.faceUp) {
					card.faceUp = true;
					next.score += SCORE_FLIP;
				}
			}

			pushUndo(current);
			finishState(next);
			setGameState(next);
			return true;
		},

		autoMoveToFoundation(from: PileLocation) {
			const current = stateRef.current;
			const pile = getPile(current, from);
			const card = pile[pile.length - 1];
			if (!card?.faceUp) return false;
			const foundationIndex = findFoundationIndex(card, current);
			if (foundationIndex < 0) return false;
			const next = cloneGameState(current);
			const cards = takeFromAt(next, from, card.id);
			if (cards.length !== 1) return false;
			const destination = next.foundations[foundationIndex];
			if (!canMoveToFoundation(cards[0], destination)) return false;
			destination.push(cards[0]);
			next.moves++;
			next.score += SCORE_FOUNDATION;
			if (from.type === 'tableau') {
				const source = next.tableau[from.index];
				const sourceTop = source[source.length - 1];
				if (sourceTop && !sourceTop.faceUp) {
					sourceTop.faceUp = true;
					next.score += SCORE_FLIP;
				}
			}
			pushUndo(current);
			finishState(next);
			setGameState(next);
			return true;
		},

		showHint() {
			const current = cloneGameState(stateRef.current);
			current.hintsUsed++;
			stateRef.current = current;
			setState(current);
			const nextHint = getHint(current);
			setHint(nextHint);
			if (hintTimer.current) clearTimeout(hintTimer.current);
			hintTimer.current = setTimeout(() => setHint(null), 2600);
		},

		undo() {
			if (undoRef.current.length === 0) return;
			stopAutoComplete();
			const previous = cloneGameState(undoRef.current[undoRef.current.length - 1]);
			previous.score = Math.max(0, previous.score + SCORE_UNDO);
			const nextUndo = undoRef.current.slice(0, -1);
			undoRef.current = nextUndo;
			wonRef.current = false;
			stateRef.current = previous;
			setUndoStack(nextUndo);
			setWon(false);
			setStuck(false);
			setState(previous);
			saveGame(previous, false, false);
		},

		clearSaved() {
			try {
				localStorage.removeItem(SAVE_KEY);
			} catch {}
		},

		getFinalScore() {
			const current = stateRef.current;
			if (!current.endTime) return current.score;
			const elapsed = (current.endTime - current.startTime) / 1000;
			return current.score + timeBonus(elapsed, current.score);
		}
	};
}

export function cloneGameState(state: GameState): GameState {
	return {
		...state,
		stock: state.stock.map((card) => ({ ...card })),
		waste: state.waste.map((card) => ({ ...card })),
		foundations: state.foundations.map((pile) => pile.map((card) => ({ ...card }))) as GameState['foundations'],
		tableau: state.tableau.map((pile) => pile.map((card) => ({ ...card }))) as GameState['tableau']
	};
}

function loadInitialGame(): InitialGame {
	try {
		const raw = localStorage.getItem(SAVE_KEY);
		if (!raw) return { state: dealState(), won: false, stuck: false, loaded: false };
		const saved = JSON.parse(raw) as SavedGame;
		if (!saved?.state) return { state: dealState(), won: false, stuck: false, loaded: false };
		if (saved.won) {
			localStorage.removeItem(SAVE_KEY);
			return { state: dealState(), won: false, stuck: false, loaded: false };
		}
		if (saved.state.mode === 'daily' && !matchesSeedBase(saved.state.seed, todaySeed())) {
			localStorage.removeItem(SAVE_KEY);
			return { state: dealState(), won: false, stuck: false, loaded: false };
		}
		const state = normalizeLoadedState(saved.state);
		if (!saved.won) state.startTime += Date.now() - (saved.saveTime ?? Date.now());
		return { state, won: false, stuck: !!saved.stuck, loaded: true };
	} catch {
		return { state: dealState(), won: false, stuck: false, loaded: false };
	}
}

function saveGame(state: GameState, won: boolean, stuck: boolean): void {
	try {
		localStorage.setItem(SAVE_KEY, JSON.stringify({ state, won, stuck, saveTime: Date.now() }));
	} catch {}
}

function dealState(drawMode: 1 | 3 = 1, mode: GameMode = 'random', seed = '', dailyRestartCount = 0): GameState {
	const baseSeed = seed || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
	const state = dealSeededState(drawMode, mode, baseSeed);
	return { ...state, dailyRestartCount };
}

function normalizeLoadedState(state: GameState): GameState {
	return {
		...state,
		dailyRestartCount: state.dailyRestartCount ?? 0
	};
}

function getPile(state: GameState, loc: PileLocation): Card[] {
	if (loc.type === 'stock') return state.stock;
	if (loc.type === 'waste') return state.waste;
	if (loc.type === 'foundation') return state.foundations[loc.index];
	return state.tableau[loc.index];
}

function takeFrom(state: GameState, loc: PileLocation): Card[] {
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
		const firstFaceUp = pile.findIndex((card) => card.faceUp);
		return firstFaceUp >= 0 ? pile.splice(firstFaceUp) : [];
	}
	return [];
}

function takeFromAt(state: GameState, loc: PileLocation, cardId: string): Card[] {
	if (loc.type !== 'tableau') return takeFrom(state, loc);
	const pile = state.tableau[loc.index];
	const index = pile.findIndex((card) => card.id === cardId);
	return index >= 0 ? pile.splice(index) : [];
}

function moveOneCardToFoundation(state: GameState): boolean {
	if (state.waste.length > 0) {
		const card = state.waste[state.waste.length - 1];
		const foundationIndex = findFoundationIndex(card, state);
		if (foundationIndex >= 0) {
			state.waste.pop();
			state.foundations[foundationIndex].push(card);
			state.score += SCORE_FOUNDATION;
			return true;
		}
	}

	for (let i = 0; i < 7; i++) {
		const pile = state.tableau[i];
		const card = pile[pile.length - 1];
		if (!card?.faceUp) continue;
		const foundationIndex = findFoundationIndex(card, state);
		if (foundationIndex >= 0) {
			pile.pop();
			state.foundations[foundationIndex].push(card);
			state.score += SCORE_FOUNDATION;
			return true;
		}
	}

	return false;
}

import type { GameState, GameMode, PileLocation, Card } from '$lib/game/types';
import { canMoveToFoundation, canMoveToTableau, isWon, findFoundationIndex, hasNoFaceDownCards } from '$lib/game/rules';
import {
	SCORE_FOUNDATION, SCORE_FLIP, SCORE_TABLEAU,
	SCORE_RECYCLE, SCORE_WASTE_TO_TABLEAU, SCORE_UNDO, timeBonus
} from '$lib/game/score';
import { getHint, hasAnyMove } from '$lib/game/hints';
import type { Hint } from '$lib/game/hints';
import { dealSolvableState } from '$lib/game/solver';

const MAX_UNDO = 100;
const SAVE_KEY = 'solitaire_game_v1';

function saveGame() {
	if (typeof localStorage === 'undefined') return;
	try {
		// JSON.stringify traverses Svelte 5 Proxy via property enumeration — no need for $state.snapshot here
		localStorage.setItem(SAVE_KEY, JSON.stringify({
			state: _state,
			won: _won,
			stuck: _stuck,
			saveTime: Date.now(),
		}));
	} catch {}
}

function dealState(drawMode: 1 | 3 = 1, mode: GameMode = 'random', seed = ''): GameState {
	if (seed) {
		return dealSolvableState(drawMode, mode, seed);
	}
	const randomSeed = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
	return dealSolvableState(drawMode, mode, randomSeed);
}

// ─── Reactive state ───────────────────────────────────────────────
let _state = $state<GameState>(dealState());
let _undoStack = $state<GameState[]>([]);
let _hint = $state<Hint | null>(null);
let _hintTimer: ReturnType<typeof setTimeout> | null = null;
let _autoCompleting = $state(false);
let _won = $state(false);
let _stuck = $state(false);
let _placesSinceRecycle = 0; // non-reactive, tracks placements since last stock recycle

function snapshot() {
	// $state.snapshot() strips Svelte's reactive Proxy — structuredClone fails on proxies
	const snap = $state.snapshot(_state) as GameState;
	_undoStack = [..._undoStack.slice(-MAX_UNDO + 1), snap];
}

function checkWin() {
	if (isWon(_state)) {
		_state.endTime = Date.now();
		_won = true;
	}
}

function checkStuck() {
	if (!_won && !_autoCompleting && !hasAnyMove(_state)) {
		_stuck = true;
	}
}

// ─── Public API ───────────────────────────────────────────────────
export const gameStore = {
	get state() { return _state; },
	get undoStack() { return _undoStack; },
	get hint() { return _hint; },
	get autoCompleting() { return _autoCompleting; },
	get won() { return _won; },
	get stuck() { return _stuck; },

	newGame(drawMode: 1 | 3 = _state.drawMode, mode: GameMode = 'random', seed = '') {
		_state = dealState(drawMode, mode, seed);
		_undoStack = [];
		_hint = null;
		_won = false;
		_autoCompleting = false;
		_stuck = false;
		_placesSinceRecycle = 0;
		saveGame();
	},

	drawFromStock() {
		snapshot();
		if (_state.stock.length === 0) {
			// Recycle waste
			if (_state.waste.length === 0) return;
			// If we already recycled once and placed nothing since then → stuck
			if (_state.recycleCount >= 1 && _placesSinceRecycle === 0 && !_won && !_autoCompleting) {
				_stuck = true;
				return;
			}
			_placesSinceRecycle = 0;
			_state.recycleCount++;
			_state.stock = _state.waste.reverse().map((c) => ({ ...c, faceUp: false }));
			_state.waste = [];
			if (_state.drawMode === 3) _state.score += SCORE_RECYCLE;
		} else {
			const count = Math.min(_state.drawMode, _state.stock.length);
			const drawn = _state.stock.splice(_state.stock.length - count, count);
			drawn.forEach((c) => (c.faceUp = true));
			_state.waste.push(...drawn);
			_state.moves++;
		}
		if (!_won && _state.stock.length === 0 && hasNoFaceDownCards(_state)) {
			this._startAutoComplete();
		}
		checkStuck();
		saveGame();
	},

	moveCards(from: PileLocation, to: PileLocation, startCardId?: string) {
		snapshot();
		const cards = startCardId ? this._takeFromAt(from, startCardId) : this._takeFrom(from);
		if (!cards || cards.length === 0) return;

		const dest = this._getPile(to);
		const topCard = cards[0];

		// Validate
		let valid = false;
		if (to.type === 'foundation') {
			valid = cards.length === 1 && canMoveToFoundation(topCard, dest);
		} else if (to.type === 'tableau') {
			valid = canMoveToTableau(topCard, dest);
		}

		if (!valid) {
			// Put cards back
			this._putBack(from, cards);
			_undoStack = _undoStack.slice(0, -1);
			return false;
		}

		dest.push(...cards);
		_state.moves++;
		_placesSinceRecycle++;

		// Score
		if (to.type === 'foundation') _state.score += SCORE_FOUNDATION;
		else if (to.type === 'tableau') {
			if (from.type === 'waste') _state.score += SCORE_WASTE_TO_TABLEAU;
			else _state.score += SCORE_TABLEAU;
		}

		// Flip top of source pile if needed
		if (from.type === 'tableau') {
			const srcPile = _state.tableau[from.index];
			if (srcPile.length > 0 && !srcPile[srcPile.length - 1].faceUp) {
				srcPile[srcPile.length - 1].faceUp = true;
				_state.score += SCORE_FLIP;
			}
		}

		checkWin();
		if (!_won && _state.stock.length === 0 && hasNoFaceDownCards(_state)) {
			this._startAutoComplete();
		}
		if (!_won && !_autoCompleting) checkStuck();
		saveGame();
		return true;
	},

	autoMoveToFoundation(from: PileLocation): boolean {
		const pile = this._getPile(from);
		if (pile.length === 0) return false;
		const card = pile[pile.length - 1];
		if (!card.faceUp) return false;
		const fi = findFoundationIndex(card, _state);
		if (fi < 0) return false;
		return this.moveCards(from, { type: 'foundation', index: fi }) !== false;
	},

	showHint() {
		if (_hintTimer) clearTimeout(_hintTimer);
		_state.hintsUsed++;
		_hint = getHint(_state);
		_hintTimer = setTimeout(() => { _hint = null; }, 2000);
	},

	undo() {
		if (_undoStack.length === 0) return;
		const prev = _undoStack[_undoStack.length - 1];
		_undoStack = _undoStack.slice(0, -1);
		_state = prev;
		_state.score += SCORE_UNDO;
		if (_state.score < 0) _state.score = 0;
		_won = false;
		_stuck = false;
		_autoCompleting = false;
		_placesSinceRecycle = 1; // prevent false stuck after undo
		saveGame();
	},

	hasSaved(): boolean {
		try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
	},

	loadSaved(): boolean {
		try {
			const raw = localStorage.getItem(SAVE_KEY);
			if (!raw) return false;
			const data = JSON.parse(raw);
			if (!data?.state) return false;
			const state = data.state as GameState;
			// Adjust startTime to exclude offline time so the timer stays accurate
			const offlineMs = Date.now() - (data.saveTime ?? Date.now());
			if (!data.won) state.startTime = state.startTime + offlineMs;
			_state = state;
			_won = data.won ?? false;
			_stuck = data.stuck ?? false;
			_undoStack = [];
			_hint = null;
			_autoCompleting = false;
			_placesSinceRecycle = 1;
			return true;
		} catch { return false; }
	},

	clearSaved() {
		try { localStorage.removeItem(SAVE_KEY); } catch {}
	},

	setDrawMode(mode: 1 | 3) {
		this.newGame(mode);
	},

	getFinalScore(): number {
		if (!_state.endTime) return _state.score;
		const elapsed = (_state.endTime - _state.startTime) / 1000;
		return _state.score + timeBonus(elapsed, _state.score);
	},

	// ─── Internal helpers ─────────────────────────────────────────
	_getPile(loc: PileLocation): Card[] {
		if (loc.type === 'stock') return _state.stock;
		if (loc.type === 'waste') return _state.waste;
		if (loc.type === 'foundation') return _state.foundations[loc.index];
		return _state.tableau[loc.index];
	},

	_takeFrom(loc: PileLocation): Card[] {
		if (loc.type === 'waste') {
			const card = _state.waste.pop();
			return card ? [card] : [];
		}
		if (loc.type === 'foundation') {
			const card = _state.foundations[loc.index].pop();
			return card ? [card] : [];
		}
		if (loc.type === 'tableau') {
			const pile = _state.tableau[loc.index];
			const firstFaceUp = pile.findIndex((c) => c.faceUp);
			if (firstFaceUp < 0) return [];
			return pile.splice(firstFaceUp);
		}
		return [];
	},

	_takeFromAt(loc: PileLocation, cardId: string): Card[] {
		if (loc.type === 'tableau') {
			const pile = _state.tableau[loc.index];
			const idx = pile.findIndex((c) => c.id === cardId);
			if (idx < 0) return [];
			return pile.splice(idx);
		}
		return this._takeFrom(loc);
	},

	_putBack(loc: PileLocation, cards: Card[]) {
		if (loc.type === 'waste') _state.waste.push(...cards);
		else if (loc.type === 'foundation') _state.foundations[loc.index].push(...cards);
		else if (loc.type === 'tableau') _state.tableau[loc.index].push(...cards);
	},

	_startAutoComplete() {
		if (_autoCompleting) return;
		_autoCompleting = true;
		this._autoCompleteStep();
	},

	_autoCompleteStep() {
		// Find any moveable card to foundation
		let moved = false;
		// Check waste first
		if (_state.waste.length > 0) {
			const card = _state.waste[_state.waste.length - 1];
			const fi = findFoundationIndex(card, _state);
			if (fi >= 0) {
				_state.waste.pop();
				_state.foundations[fi].push({ ...card });
				_state.score += SCORE_FOUNDATION;
				moved = true;
			}
		}
		if (!moved) {
			for (let i = 0; i < 7; i++) {
				const pile = _state.tableau[i];
				if (pile.length === 0) continue;
				const card = pile[pile.length - 1];
				const fi = findFoundationIndex(card, _state);
				if (fi >= 0) {
					pile.pop();
					_state.foundations[fi].push({ ...card });
					_state.score += SCORE_FOUNDATION;
					moved = true;
					break;
				}
			}
		}
		if (isWon(_state)) {
			_state.endTime = Date.now();
			_won = true;
			_autoCompleting = false;
			saveGame();
			return;
		}
		if (moved) {
			setTimeout(() => this._autoCompleteStep(), 80);
		} else {
			_autoCompleting = false;
		}
	}
};

import type { Card, PileLocation } from '$lib/game/types';

export interface DragState {
	active: boolean;
	cards: Card[];
	from: PileLocation | null;
	x: number;
	y: number;
	startX: number;
	startY: number;
	originX: number; // element's bounding rect left
	originY: number; // element's bounding rect top
	tilt: number;    // degrees, from velocity
}

let _drag = $state<DragState>({
	active: false,
	cards: [],
	from: null,
	x: 0,
	y: 0,
	startX: 0,
	startY: 0,
	originX: 0,
	originY: 0,
	tilt: 0
});

// Velocity tracking (last 3 x positions)
const _xHistory: number[] = [];

export const dragState = {
	get active() { return _drag.active; },
	get cards() { return _drag.cards; },
	get from() { return _drag.from; },
	get x() { return _drag.x; },
	get y() { return _drag.y; },
	get originX() { return _drag.originX; },
	get originY() { return _drag.originY; },
	get tilt() { return _drag.tilt; },

	start(cards: Card[], from: PileLocation, x: number, y: number, originX: number, originY: number) {
		_xHistory.length = 0;
		_xHistory.push(x);
		_drag = { active: true, cards, from, x, y, startX: x, startY: y, originX, originY, tilt: 0 };
	},

	move(x: number, y: number) {
		_xHistory.push(x);
		if (_xHistory.length > 3) _xHistory.shift();
		const vel = _xHistory.length >= 2
			? _xHistory[_xHistory.length - 1] - _xHistory[0]
			: 0;
		_drag.tilt = Math.max(-12, Math.min(12, vel * 0.8));
		_drag.x = x;
		_drag.y = y;
	},

	end() {
		_drag = { ..._drag, active: false, cards: [], from: null, tilt: 0 };
		_xHistory.length = 0;
	}
};

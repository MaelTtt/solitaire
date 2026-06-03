import { useMemo, useRef, useState } from 'preact/hooks';
import type { Card, PileLocation } from '@/lib/game/types';

export interface DragState {
	active: boolean;
	cards: Card[];
	from: PileLocation | null;
	x: number;
	y: number;
	tilt: number;
}

const EMPTY_DRAG: DragState = {
	active: false,
	cards: [],
	from: null,
	x: 0,
	y: 0,
	tilt: 0
};

export function useDragState() {
	const [drag, setDrag] = useState<DragState>(EMPTY_DRAG);
	const history = useRef<number[]>([]);

	return useMemo(() => ({
		drag,
		start(cards: Card[], from: PileLocation, x: number, y: number) {
			history.current = [x];
			setDrag({ active: true, cards, from, x, y, tilt: 0 });
		},
		move(x: number, y: number) {
			history.current.push(x);
			if (history.current.length > 3) history.current.shift();
			const vel = history.current.length >= 2 ? history.current[history.current.length - 1] - history.current[0] : 0;
			setDrag((current) => ({ ...current, x, y, tilt: Math.max(-12, Math.min(12, vel * 0.8)) }));
		},
		end() {
			history.current = [];
			setDrag(EMPTY_DRAG);
		}
	}), [drag]);
}

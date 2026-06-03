import { useRef } from 'preact/hooks';
import type { JSX } from 'preact';
import type { Card as CardModel, PileLocation } from '@/lib/game/types';
import type { DragState } from '@/lib/ui/drag';
import type { ScreenMetrics } from '@/lib/ui/screen';
import { Card } from './Card';

interface WastePileProps {
	cards: CardModel[];
	drawMode: 1 | 3;
	hintedCardId: string | null;
	drag: DragState;
	screen: ScreenMetrics;
	onStartDrag: (cards: CardModel[], from: PileLocation, x: number, y: number) => void;
	onAutoFoundation: (from: PileLocation) => void;
}

export function WastePile({ cards, drawMode, hintedCardId, drag, screen, onStartDrag, onAutoFoundation }: WastePileProps) {
	const loc: PileLocation = { type: 'waste', index: 0 };
	const visibleCards = cards.slice(-Math.min(cards.length, drawMode === 3 ? 3 : 1));
	const lastTapTime = useRef(0);

	const handlePointerDown = (event: JSX.TargetedPointerEvent<HTMLDivElement>, card: CardModel, isTop: boolean) => {
		if (!isTop) return;
		event.preventDefault();
		const now = Date.now();
		if (now - lastTapTime.current < 350) {
			onAutoFoundation(loc);
			lastTapTime.current = 0;
			return;
		}
		lastTapTime.current = now;
		event.currentTarget.setPointerCapture(event.pointerId);
		onStartDrag([card], loc, event.clientX, event.clientY);
	};

	return (
		<div class="waste-pile">
			{visibleCards.length === 0 ? (
				<div class="empty-slot" />
			) : (
				visibleCards.map((card, i) => {
					const isTop = i === visibleCards.length - 1;
					const isDragging = drag.active && drag.cards[0]?.id === card.id;
					return (
						<div
							key={card.id}
							class={`card-wrapper ${isDragging ? 'drag-ghost' : ''}`}
							style={`left:${i * screen.wasteOffset}px;pointer-events:${isTop ? 'auto' : 'none'}`}
						>
							<Card
								card={card}
								hinted={isTop && hintedCardId === card.id}
								dragging={isDragging}
								onPointerDown={(event) => handlePointerDown(event, card, isTop)}
								onDblClick={() => isTop && onAutoFoundation(loc)}
							/>
						</div>
					);
				})
			)}
		</div>
	);
}

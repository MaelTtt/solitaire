import type { JSX } from 'preact';
import { useRef } from 'preact/hooks';
import type { Card as CardModel, PileLocation } from '@/lib/game/types';
import type { DragState } from '@/lib/ui/drag';
import type { ScreenMetrics } from '@/lib/ui/screen';
import { Card } from './Card';

interface TableauPileProps {
	cards: CardModel[];
	index: number;
	hintedCardId: string | null;
	isDropTarget: boolean;
	drag: DragState;
	screen: ScreenMetrics;
	onStartDrag: (cards: CardModel[], from: PileLocation, x: number, y: number) => void;
	onAutoFoundation: (from: PileLocation) => void;
}

export function TableauPile({ cards, index, hintedCardId, isDropTarget, drag, screen, onStartDrag, onAutoFoundation }: TableauPileProps) {
	const loc: PileLocation = { type: 'tableau', index };
	const lastTapCardId = useRef('');
	const lastTapTime = useRef(0);

	const cardTop = (cardIndex: number) => {
		let top = 0;
		for (let i = 0; i < cardIndex; i++) top += cards[i].faceUp ? screen.faceUpOffset : screen.faceDownOffset;
		return top;
	};

	const handlePointerDown = (event: JSX.TargetedPointerEvent<HTMLDivElement>, card: CardModel, cardIndex: number) => {
		if (!card.faceUp) return;
		event.preventDefault();
		const now = Date.now();
		const isDoubleTap = card.id === lastTapCardId.current && now - lastTapTime.current < 350;
		lastTapCardId.current = card.id;
		lastTapTime.current = now;
		if (isDoubleTap && cardIndex === cards.length - 1) {
			onAutoFoundation(loc);
			return;
		}
		event.currentTarget.setPointerCapture(event.pointerId);
		onStartDrag(cards.slice(cardIndex), loc, event.clientX, event.clientY);
	};

	return (
		<div class={`tableau-pile ${isDropTarget ? 'drop-target' : ''}`} data-pile-type="tableau" data-pile-index={index}>
			{cards.length === 0 ? (
				<div class="empty-slot" data-pile-type="tableau" data-pile-index={index} />
			) : (
				cards.map((card, i) => {
					const startIndex = cards.findIndex((c) => c.id === drag.cards[0]?.id);
					const isDragging = drag.active && drag.from?.type === 'tableau' && drag.from.index === index && startIndex >= 0 && i >= startIndex;
					return (
						<div key={card.id} class={`card-wrapper ${isDragging ? 'drag-ghost' : ''}`} style={`top:${cardTop(i)}px`}>
							<Card
								card={card}
								hinted={hintedCardId === card.id}
								dragging={isDragging}
								onPointerDown={(event) => handlePointerDown(event, card, i)}
								onDblClick={() => card.faceUp && i === cards.length - 1 && onAutoFoundation(loc)}
							/>
						</div>
					);
				})
			)}
		</div>
	);
}

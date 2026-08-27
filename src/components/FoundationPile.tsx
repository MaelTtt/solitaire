import type { JSX } from 'preact';
import type { Card as CardModel, PileLocation } from '@/lib/game/types';
import type { DragState } from '@/lib/ui/drag';
import { Card } from './Card';
import { PixelIcon, type PixelIconName } from './PixelIcon';

interface FoundationPileProps {
	cards: CardModel[];
	index: number;
	isDropTarget: boolean;
	drag: DragState;
	onStartDrag: (cards: CardModel[], from: PileLocation, x: number, y: number) => void;
}

const SUIT_ICONS: PixelIconName[] = ['spade', 'heart', 'diamond', 'club'];

export function FoundationPile({ cards, index, isDropTarget, drag, onStartDrag }: FoundationPileProps) {
	const loc: PileLocation = { type: 'foundation', index };
	const top = cards[cards.length - 1];

	const handlePointerDown = (event: JSX.TargetedPointerEvent<HTMLDivElement>) => {
		if (!top) return;
		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		onStartDrag([top], loc, event.clientX, event.clientY);
	};

	return (
		<div class={`foundation-pile ${isDropTarget ? 'drop-target' : ''}`} data-pile-type="foundation" data-pile-index={index}>
			{top ? (
				<Card
					card={top}
					dragging={drag.active && drag.cards[0]?.id === top.id && drag.from?.type === 'foundation' && drag.from.index === index}
					onPointerDown={handlePointerDown}
				/>
			) : (
				<div class="empty-slot" data-pile-type="foundation" data-pile-index={index}>
					<span class="placeholder"><PixelIcon name={SUIT_ICONS[index]} size={28} /></span>
				</div>
			)}
		</div>
	);
}

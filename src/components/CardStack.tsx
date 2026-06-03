import type { Card } from '@/lib/game/types';
import { spriteStyle } from '@/lib/game/cardImage';

interface CardStackProps {
	cards: Card[];
	tilt: number;
}

export function CardStack({ cards, tilt }: CardStackProps) {
	return (
		<div class="stack" style={`--drag-tilt:${tilt}deg;--stack-count:${cards.length};--stack-offset:var(--face-up-offset, 22px)`}>
			{cards.map((card, index) => (
				<div
					key={card.id}
					class="ghost-card"
					style={`top:calc(${index} * var(--stack-offset));z-index:${index};${spriteStyle(card.suit, card.rank)}`}
				/>
			))}
		</div>
	);
}

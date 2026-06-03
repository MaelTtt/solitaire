import { useRef } from 'preact/hooks';
import type { JSX } from 'preact';
import type { Card } from '@/lib/game/types';

interface StockPileProps {
	cards: Card[];
	hinted: boolean;
	onDraw: () => void;
}

export function StockPile({ cards, hinted, onDraw }: StockPileProps) {
	const down = useRef({ x: 0, y: 0, didDraw: false });

	const onPointerDown: JSX.PointerEventHandler<HTMLDivElement> = (event) => {
		event.preventDefault();
		event.stopPropagation();
		down.current = { x: event.clientX, y: event.clientY, didDraw: false };
		event.currentTarget.setPointerCapture(event.pointerId);
	};

	const onPointerUp: JSX.PointerEventHandler<HTMLDivElement> = (event) => {
		event.preventDefault();
		event.stopPropagation();
		const dx = event.clientX - down.current.x;
		const dy = event.clientY - down.current.y;
		if (Math.hypot(dx, dy) < 10) {
			onDraw();
			down.current.didDraw = true;
		}
	};

	const onClick: JSX.MouseEventHandler<HTMLDivElement> = () => {
		if (!down.current.didDraw) onDraw();
		down.current.didDraw = false;
	};

	return (
		<div
			class={`stock-pile ${hinted ? 'hinted' : ''}`}
			role="button"
			tabIndex={0}
			title="Draw card"
			onPointerDown={onPointerDown}
			onPointerUp={onPointerUp}
			onClick={onClick}
			onKeyDown={(event) => event.key === 'Enter' && onDraw()}
		>
			{cards.length > 0 ? (
				<>
					<div class="card-back" />
					{cards.length > 2 && <div class="card-back offset2" />}
					{cards.length > 4 && <div class="card-back offset3" />}
					<span class="count">{cards.length}</span>
				</>
			) : (
				<div class="empty-slot">
					<span class="recycle">↺</span>
				</div>
			)}
		</div>
	);
}

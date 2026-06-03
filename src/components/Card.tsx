import { useState } from 'preact/hooks';
import type { JSX } from 'preact';
import type { Card as CardModel } from '@/lib/game/types';
import { spriteStyle } from '@/lib/game/cardImage';

interface CardProps {
	card: CardModel;
	hinted?: boolean;
	dragging?: boolean;
	onPointerDown?: JSX.PointerEventHandler<HTMLDivElement>;
	onDblClick?: JSX.MouseEventHandler<HTMLDivElement>;
}

export function Card({ card, hinted = false, dragging = false, onPointerDown, onDblClick }: CardProps) {
	const [tilt, setTilt] = useState({ rx: 0, ry: 0, sc: 1 });

	const onPointerMove: JSX.PointerEventHandler<HTMLDivElement> = (event) => {
		if (!card.faceUp || dragging) return;
		const rect = event.currentTarget.getBoundingClientRect();
		const nx = (event.clientX - rect.left) / rect.width - 0.5;
		const ny = (event.clientY - rect.top) / rect.height - 0.5;
		setTilt({ rx: -ny * 18, ry: nx * 18, sc: 1.08 });
	};

	const resetTilt = () => setTilt({ rx: 0, ry: 0, sc: 1 });

	return (
		<div
			class={`card ${card.faceUp ? 'face-up' : 'face-down'} ${hinted ? 'hinted' : ''} ${dragging ? 'dragging' : ''}`}
			style={`${card.faceUp ? spriteStyle(card.suit, card.rank) : ''};--rx:${dragging ? 0 : tilt.rx}deg;--ry:${dragging ? 0 : tilt.ry}deg;--sc:${dragging ? 1 : tilt.sc}`}
			onPointerMove={onPointerMove}
			onPointerLeave={resetTilt}
			onPointerDown={onPointerDown}
			onDblClick={onDblClick}
			role="button"
			tabIndex={0}
		>
			{card.faceUp ? <div class="shine" /> : <div class="card-back" />}
		</div>
	);
}

<script lang="ts">
	import type { Card, PileLocation } from '$lib/game/types';
	import { dragState } from '$lib/utils/dragState.svelte';
	import { gameStore } from '$lib/stores/gameStore.svelte';
	import { screen } from '$lib/stores/screenStore.svelte';
	import { canMoveToTableau } from '$lib/game/rules';
	import CardComponent from './Card.svelte';

	interface Props {
		cards: Card[];
		index: number;
		hintedCardId?: string | null;
		isDropTarget?: boolean;
	}
	let { cards, index, hintedCardId = null, isDropTarget = false }: Props = $props();

	const loc = $derived<PileLocation>({ type: 'tableau', index });

	let lastTapCardId = '';
	let lastTapTime = 0;

	function handlePointerDown(e: PointerEvent, card: Card, cardIdx: number) {
		if (!card.faceUp) return;
		e.preventDefault();

		// Double-tap detection (works for both mouse dblclick and touch)
		const now = Date.now();
		const isDoubleTap = card.id === lastTapCardId && now - lastTapTime < 350;
		lastTapCardId = card.id;
		lastTapTime = now;

		if (isDoubleTap && cardIdx === cards.length - 1) {
			gameStore.autoMoveToFoundation(loc);
			return;
		}

		const el = e.currentTarget as HTMLElement;
		el.setPointerCapture(e.pointerId);
		const rect = el.getBoundingClientRect();
		const draggingCards = cards.slice(cardIdx);
		dragState.start(draggingCards, loc, e.clientX, e.clientY, rect.left, rect.top);
	}

	function handleDblClick(card: Card) {
		if (!card.faceUp) return;
		const cardIdx = cards.indexOf(card);
		if (cardIdx !== cards.length - 1) return;
		gameStore.autoMoveToFoundation(loc);
	}

	function cardTop(i: number): number {
		let top = 0;
		for (let j = 0; j < i; j++) {
			top += cards[j].faceUp ? screen.faceUpOffset : screen.faceDownOffset;
		}
		return top;
	}
</script>

<div
	class="tableau-pile"
	class:drop-target={isDropTarget}
	data-pile-type="tableau"
	data-pile-index={index}
>
	{#if cards.length === 0}
		<div class="empty-slot" data-pile-type="tableau" data-pile-index={index}></div>
	{:else}
		{#each cards as card, i}
			{@const isDragging = dragState.active && dragState.from?.type === 'tableau' && dragState.from.index === index && i >= cards.findIndex(c => c.id === dragState.cards[0]?.id) && dragState.cards[0] !== undefined}
			<div
				class="card-wrapper"
				style="top: {cardTop(i)}px"
				class:drag-ghost={isDragging}
			>
				<CardComponent
					{card}
					hinted={hintedCardId === card.id}
					dragging={isDragging}
					onpointerdown={(e) => handlePointerDown(e, card, i)}
					ondblclick={() => handleDblClick(card)}
				/>
			</div>
		{/each}
	{/if}
</div>

<style>
	.tableau-pile {
		position: relative;
		width: var(--card-w, 80px);
		min-height: var(--card-h, 112px);
		flex-shrink: 0;
	}
	.empty-slot {
		width: var(--card-w, 80px);
		height: var(--card-h, 112px);
		border-radius: var(--card-radius, 4px);
		border: 2px dashed rgba(255,255,255,0.15);
	}
	.drop-target .empty-slot,
	.drop-target {
		outline: 2px solid rgba(100,220,100,0.6);
		outline-offset: 2px;
		border-radius: var(--card-radius, 4px);
	}
	.card-wrapper {
		position: absolute;
		left: 0;
	}
	.drag-ghost {
		opacity: 0.3;
		pointer-events: none;
	}
</style>

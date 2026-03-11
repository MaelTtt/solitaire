<script lang="ts">
	import type { Card, PileLocation } from '$lib/game/types';
	import { dragState } from '$lib/utils/dragState.svelte';
	import { gameStore } from '$lib/stores/gameStore.svelte';
	import { screen } from '$lib/stores/screenStore.svelte';
	import CardComponent from './Card.svelte';

	interface Props {
		cards: Card[];
		drawMode: 1 | 3;
		hintedCardId?: string | null;
	}
	let { cards, drawMode, hintedCardId = null }: Props = $props();

	const loc: PileLocation = { type: 'waste', index: 0 };

	// Show last 1 or 3 cards depending on draw mode
	const visibleCount = $derived(Math.min(cards.length, drawMode === 3 ? 3 : 1));
	const visibleCards = $derived(cards.slice(-visibleCount));

	let lastTapTime = 0;

	function handlePointerDown(e: PointerEvent, card: Card, isTop: boolean) {
		if (!isTop) return;
		e.preventDefault();

		// Double-tap to foundation
		const now = Date.now();
		if (now - lastTapTime < 350) {
			gameStore.autoMoveToFoundation(loc);
			lastTapTime = 0;
			return;
		}
		lastTapTime = now;

		const el = e.currentTarget as HTMLElement;
		el.setPointerCapture(e.pointerId);
		const rect = el.getBoundingClientRect();
		dragState.start([card], loc, e.clientX, e.clientY, rect.left, rect.top);
	}

	function handleDblClick(card: Card, isTop: boolean) {
		if (!isTop) return;
		gameStore.autoMoveToFoundation(loc);
	}

	const visibleOffset = $derived(screen.wasteOffset);
</script>

<div class="waste-pile">
	{#if visibleCards.length === 0}
		<div class="empty-slot"></div>
	{:else}
		{#each visibleCards as card, i}
			{@const isTop = i === visibleCards.length - 1}
			{@const isDragging = dragState.active && dragState.cards[0]?.id === card.id}
			<div
				class="card-wrapper"
				style="left:{i * visibleOffset}px"
				style:pointer-events={isTop ? 'auto' : 'none'}
				class:drag-ghost={isDragging}
			>
				<CardComponent
					{card}
					hinted={isTop && hintedCardId === card.id}
					dragging={isDragging}
					onpointerdown={(e) => handlePointerDown(e, card, isTop)}
					ondblclick={() => handleDblClick(card, isTop)}
				/>
			</div>
		{/each}
	{/if}
</div>

<style>
	.waste-pile {
		position: relative;
		width: calc(var(--card-w, 80px) * 1.46);
		height: var(--card-h, 112px);
		flex-shrink: 0;
	}
	.empty-slot {
		width: var(--card-w, 80px);
		height: var(--card-h, 112px);
		border-radius: var(--card-radius, 4px);
		border: 2px dashed rgba(255,255,255,0.15);
	}
	.card-wrapper {
		position: absolute;
		top: 0;
	}
	.drag-ghost {
		opacity: 0;
		pointer-events: none;
	}
</style>

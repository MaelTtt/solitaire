<script lang="ts">
	import type { Card, PileLocation } from '$lib/game/types';
	import { suitSymbol } from '$lib/game/deck';
	import { dragState } from '$lib/utils/dragState.svelte';
	import { gameStore } from '$lib/stores/gameStore.svelte';
	import CardComponent from './Card.svelte';

	interface Props {
		cards: Card[];
		index: number;
		isDropTarget?: boolean;
	}
	let { cards, index, isDropTarget = false }: Props = $props();

	const SUIT_PLACEHOLDERS = ['♠', '♥', '♦', '♣'];
	const loc = $derived<PileLocation>({ type: 'foundation', index });

	function handlePointerDown(e: PointerEvent, card: Card) {
		e.preventDefault();
		const el = e.currentTarget as HTMLElement;
		el.setPointerCapture(e.pointerId);
		const rect = el.getBoundingClientRect();
		dragState.start([card], loc, e.clientX, e.clientY, rect.left, rect.top);
	}

	function handleDblClick(card: Card) {
		// Nothing useful from foundation
	}
</script>

<div
	class="foundation-pile"
	class:drop-target={isDropTarget}
	data-pile-type="foundation"
	data-pile-index={index}
>
	{#if cards.length === 0}
		<div class="empty-slot" data-pile-type="foundation" data-pile-index={index}>
			<span class="placeholder">{SUIT_PLACEHOLDERS[index]}</span>
		</div>
	{:else}
		{@const card = cards[cards.length - 1]}
		<CardComponent
			{card}
			dragging={dragState.active && dragState.cards[0]?.id === card.id && dragState.from?.type === 'foundation' && dragState.from.index === index}
			onpointerdown={(e) => handlePointerDown(e, card)}
			ondblclick={() => handleDblClick(card)}
		/>
	{/if}
</div>

<style>
	.foundation-pile {
		position: relative;
		width: var(--card-w, 80px);
		height: var(--card-h, 112px);
	}
	.empty-slot {
		width: 100%;
		height: 100%;
		border-radius: var(--card-radius, 4px);
		border: 2px dashed rgba(255,255,255,0.2);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.placeholder {
		font-size: 32px;
		opacity: 0.25;
	}
	.drop-target {
		outline: 2px solid rgba(100,220,100,0.7);
		outline-offset: 2px;
		border-radius: var(--card-radius, 4px);
	}
</style>

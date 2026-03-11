<script lang="ts">
	import type { Card } from '$lib/game/types';
	import { gameStore } from '$lib/stores/gameStore.svelte';

	interface Props {
		cards: Card[];
		hinted?: boolean;
	}
	let { cards, hinted = false }: Props = $props();

	let downX = 0;
	let downY = 0;
	let didDraw = false;

	function onpointerdown(e: PointerEvent) {
		e.preventDefault();
		e.stopPropagation();
		downX = e.clientX;
		downY = e.clientY;
		didDraw = false;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onpointerup(e: PointerEvent) {
		e.preventDefault();
		e.stopPropagation();
		const dx = e.clientX - downX;
		const dy = e.clientY - downY;
		if (Math.sqrt(dx * dx + dy * dy) < 10) {
			gameStore.drawFromStock();
			didDraw = true;
		}
	}

	// Fallback for desktop click (in case pointer events don't fire)
	function onclick(e: MouseEvent) {
		if (!didDraw) {
			gameStore.drawFromStock();
		}
		didDraw = false;
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="stock-pile"
	class:hinted
	role="button"
	tabindex="0"
	title="Draw card"
	{onpointerdown}
	{onpointerup}
	{onclick}
	onkeydown={(e) => e.key === 'Enter' && gameStore.drawFromStock()}
>
	{#if cards.length > 0}
		<div class="card-back"></div>
		{#if cards.length > 2}
			<div class="card-back offset2"></div>
		{/if}
		{#if cards.length > 4}
			<div class="card-back offset3"></div>
		{/if}
		<span class="count">{cards.length}</span>
	{:else}
		<div class="empty-slot">
			<span class="recycle">↺</span>
		</div>
	{/if}
</div>

<style>
	.stock-pile {
		position: relative;
		width: var(--card-w, 80px);
		height: var(--card-h, 112px);
		border-radius: var(--card-radius, 4px);
		overflow: hidden;
		cursor: pointer;
		flex-shrink: 0;
		touch-action: none;
		-webkit-tap-highlight-color: transparent;
		image-rendering: pixelated;
	}
	.stock-pile.hinted {
		animation: hint-glow 2s ease-in-out;
	}
	.card-back {
		position: absolute;
		inset: 0;
		background-image: url('/red-deck.png');
		background-size: cover;
		background-position: center;
		transition: filter 0.1s;
	}
	.stock-pile:hover .card-back,
	.stock-pile:active .card-back {
		filter: brightness(1.2);
	}
	.offset2 { top: -3px; left: -2px; z-index: -1; opacity: 0.7; }
	.offset3 { top: -5px; left: -4px; z-index: -2; opacity: 0.5; }
	.count {
		position: absolute;
		bottom: 6px;
		right: 8px;
		font-size: 11px;
		font-weight: 700;
		color: rgba(255,255,255,0.7);
		pointer-events: none;
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
	.recycle {
		font-size: 36px;
		opacity: 0.4;
		color: white;
	}
	@keyframes hint-glow {
		0%, 100% { box-shadow: none; }
		25%, 75% { box-shadow: 0 0 20px 6px rgba(250,200,0,0.8); }
	}
</style>

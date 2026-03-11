<script lang="ts">
	import type { Card } from '$lib/game/types';
	import { spriteStyle } from '$lib/game/cardImage';

	interface Props {
		cards: Card[];
		tilt?: number;
	}
	let { cards, tilt = 0 }: Props = $props();
</script>

<div class="stack" style="--drag-tilt:{tilt}deg; --stack-count:{cards.length}">
	{#each cards as card, i}
		<div
			class="ghost-card"
			style="top:{i * 22}px; z-index:{i}; {spriteStyle(card.suit, card.rank)}"
		></div>
	{/each}
</div>

<style>
	.stack {
		position: relative;
		width: var(--card-w, 80px);
		height: calc(var(--card-h, 112px) + (var(--stack-count, 1) - 1) * 22px);
		transform: rotate(var(--drag-tilt));
		pointer-events: none;
	}
	.ghost-card {
		position: absolute;
		width: var(--card-w, 80px);
		height: var(--card-h, 112px);
		border-radius: var(--card-radius, 4px);
		background-color: white;
		box-shadow: 0 4px 16px rgba(0,0,0,0.5);
	}
</style>

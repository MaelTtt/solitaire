<script lang="ts">
	import type { Card } from '$lib/game/types';
	import { spring } from 'svelte/motion';
	import { spriteStyle } from '$lib/game/cardImage';

	interface Props {
		card: Card;
		hinted?: boolean;
		dragging?: boolean;
		dragTilt?: number;
		onpointerdown?: (e: PointerEvent) => void;
		ondblclick?: (e: MouseEvent) => void;
	}

	let {
		card,
		hinted = false,
		dragging = false,
		dragTilt = 0,
		onpointerdown,
		ondblclick
	}: Props = $props();

	const tilt = spring({ rx: 0, ry: 0, sc: 1 }, { stiffness: 0.5, damping: 0.88 });
	let el: HTMLElement;

	function onpointerenter() {
		if (!card.faceUp || dragging) return;
		tilt.update(v => ({ ...v, sc: 1.08 }));
	}

	function onpointermove(e: PointerEvent) {
		if (!el || !card.faceUp || dragging) return;
		const rect = el.getBoundingClientRect();
		const nx = (e.clientX - rect.left) / rect.width - 0.5;
		const ny = (e.clientY - rect.top) / rect.height - 0.5;
		tilt.update(v => ({ ...v, rx: -ny * 18, ry: nx * 18 }));
	}

	function onpointerleave() {
		tilt.set({ rx: 0, ry: 0, sc: 1 });
	}

	$effect(() => {
		if (el) {
			el.style.setProperty('--rx', `${dragging ? 0 : $tilt.rx}deg`);
			el.style.setProperty('--ry', `${dragging ? dragTilt : $tilt.ry}deg`);
			el.style.setProperty('--sc', `${dragging ? 1 : $tilt.sc}`);
		}
	});

	const faceStyle = $derived(card.faceUp ? spriteStyle(card.suit, card.rank) : '');
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={el}
	class="card"
	class:face-up={card.faceUp}
	class:face-down={!card.faceUp}
	class:hinted
	class:dragging
	style={faceStyle}
	{onpointerenter}
	{onpointermove}
	{onpointerleave}
	{onpointerdown}
	{ondblclick}
	role="button"
	tabindex="0"
>
	{#if card.faceUp}
		<div class="shine"></div>
	{:else}
		<div class="card-back"></div>
	{/if}
</div>

<style>
	.card {
		--rx: 0deg;
		--ry: 0deg;
		--sc: 1;
		position: relative;
		width: var(--card-w, 80px);
		height: var(--card-h, 112px);
		border-radius: var(--card-radius, 6px);
		overflow: hidden;
		transform: perspective(600px) rotateX(var(--rx)) rotateY(var(--ry)) scale(var(--sc));
		cursor: grab;
		user-select: none;
		touch-action: none;
		flex-shrink: 0;
		will-change: transform;
		image-rendering: pixelated;
	}
	.card.face-down {
		cursor: default;
	}
	.card.hinted {
		animation: hint-glow 2s ease-in-out;
	}
	.card.dragging {
		cursor: grabbing;
	}

	.shine {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: radial-gradient(
			ellipse at calc(50% - var(--ry) * 2) calc(50% + var(--rx) * 2),
			rgba(255,255,255,0.38) 0%,
			transparent 60%
		);
		z-index: 10;
	}

	.card-back {
		position: absolute;
		inset: 0;
		background-image: url('/red-deck.png');
		background-size: cover;
		background-position: center;
		image-rendering: pixelated;
	}

	@keyframes hint-glow {
		0%, 100% { box-shadow: none; }
		25%, 75% { box-shadow: 0 0 20px 6px rgba(250,200,0,0.8); }
	}
</style>

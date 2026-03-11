<script lang="ts">
	import { gameStore } from '$lib/stores/gameStore.svelte';

	interface Props { drawMode: 1 | 3; canUndo: boolean; onNewGame: () => void; }
	let { drawMode, canUndo, onNewGame }: Props = $props();
</script>

<div class="controls">
	<button class="btn" onclick={onNewGame}>New</button>
	<button class="btn" disabled={!canUndo} onclick={() => gameStore.undo()}>Undo</button>
	<button class="btn accent" onclick={() => gameStore.showHint()}>Hint</button>
	<div class="draw-toggle">
		<button class="tog" class:on={drawMode === 1} onclick={() => gameStore.setDrawMode(1)}>Draw 1</button>
		<button class="tog" class:on={drawMode === 3} onclick={() => gameStore.setDrawMode(3)}>Draw 3</button>
	</div>
</div>

<style>
	.controls { display: flex; gap: 6px; align-items: center; }

	.btn {
		padding: 7px 16px;
		border-radius: 8px;
		border: 1px solid rgba(255,255,255,0.15);
		background: rgba(255,255,255,0.08);
		color: rgba(255,255,255,0.85);
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.12s, transform 0.08s;
		letter-spacing: 0.01em;
	}
	.btn:hover:not(:disabled) { background: rgba(255,255,255,0.15); transform: translateY(-1px); }
	.btn:disabled { opacity: 0.3; cursor: not-allowed; }

	.btn.accent {
		background: linear-gradient(135deg, #2d6a2d, #1a4a1a);
		border-color: rgba(80,200,80,0.4);
		color: #a8f0a0;
	}
	.btn.accent:hover { background: linear-gradient(135deg, #3a7a3a, #245424); }

	.draw-toggle {
		display: flex;
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid rgba(255,255,255,0.15);
	}
	.tog {
		padding: 7px 12px;
		border: none;
		background: rgba(255,255,255,0.05);
		color: rgba(255,255,255,0.35);
		font-size: 12px;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.12s, color 0.12s;
	}
	.tog.on {
		background: rgba(80,200,80,0.15);
		color: #a8f0a0;
	}
</style>

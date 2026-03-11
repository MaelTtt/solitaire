<script lang="ts">
	import { gameStore } from '$lib/stores/gameStore.svelte';

	interface Props {
		onNewGame: () => void;
	}
	let { onNewGame }: Props = $props();
</script>

<div class="overlay">
	<div class="panel">
		<div class="icon">🃏</div>
		<div class="title">Plus de coups</div>
		<p class="sub">Le jeu est bloqué, plus aucun mouvement n'est possible.</p>
		<div class="actions">
			{#if gameStore.undoStack.length > 0}
				<button class="btn undo" onclick={() => gameStore.undo()}>Défaire</button>
			{/if}
			<button class="btn new" onclick={onNewGame}>Nouvelle partie</button>
		</div>
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0,0,0,0.65);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 16px;
		animation: fade-in 0.3s ease;
	}
	.panel {
		background: #24394f;
		border: 4px solid white;
		border-radius: 12px;
		padding: 24px 20px;
		text-align: center;
		color: white;
		box-shadow: 0 8px 0 rgba(0,0,0,0.5), 0 24px 60px rgba(0,0,0,0.7);
		max-width: 340px;
		width: 100%;
		animation: pop-in 0.35s cubic-bezier(0.34,1.56,0.64,1);
	}
	.icon { font-size: 48px; margin-bottom: 12px; }
	.title { font-size: 26px; text-shadow: 0 4px 0 rgba(0,0,0,0.5); margin-bottom: 8px; }
	.sub { font-size: 13px; color: rgba(255,255,255,0.5); margin-bottom: 24px; line-height: 1.5; }
	.actions { display: flex; gap: 10px; justify-content: center; }
	.btn {
		padding: 10px 22px;
		border-radius: 6px;
		border: none;
		color: white;
		font-size: 13px;
		font-family: inherit;
		cursor: pointer;
		transition: transform 0.06s, box-shadow 0.06s;
	}
	.btn:hover { transform: translateY(1px); }
	.btn:active { transform: translateY(4px); }
	.undo {
		background: rgba(255,255,255,0.15);
		box-shadow: 0 4px 0 rgba(0,0,0,0.4);
	}
	.undo:hover { box-shadow: 0 3px 0 rgba(0,0,0,0.4); }
	.undo:active { box-shadow: 0 0 0 rgba(0,0,0,0.4); }
	.new {
		background: #ff4444;
		box-shadow: 0 4px 0 #8a1a1a;
	}
	.new:hover { box-shadow: 0 3px 0 #8a1a1a; }
	.new:active { box-shadow: 0 0 0 #8a1a1a; }

	@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
	@keyframes pop-in { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>

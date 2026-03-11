<script lang="ts">
	import { leaderboard, fmtTime } from '$lib/stores/leaderboardStore.svelte';

	interface Props { onclose: () => void; }
	let { onclose }: Props = $props();

	function fmtDate(iso: string) {
		return new Date(iso + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	function onOverlayClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="overlay" onclick={onOverlayClick}>
	<div class="panel">
		<div class="panel-header">
			<span class="title">🏆 Classement</span>
			<button class="close-btn" onclick={onclose}>✕</button>
		</div>

		<div class="lb-tabs">
			<div class="lb-section">
				<div class="lb-head">Partie du jour</div>
				{#if leaderboard.daily.length === 0}
					<div class="lb-empty">Aucune partie aujourd'hui</div>
				{:else}
					{#each leaderboard.daily as e, i}
						<div class="lb-row" class:gold={i===0} class:silver={i===1} class:bronze={i===2}>
							<span class="lb-rank">#{i + 1}</span>
							<span class="lb-name">{e.name}</span>
							<span class="lb-score">{e.score}pts</span>
							<span class="lb-time">{fmtTime(e.timeSeconds)}</span>
						</div>
					{/each}
				{/if}
			</div>

			<div class="lb-divider"></div>

			<div class="lb-section">
				<div class="lb-head">Meilleur total</div>
				{#if leaderboard.allTime.length === 0}
					<div class="lb-empty">Aucune partie jouée</div>
				{:else}
					{#each leaderboard.allTime as e, i}
						<div class="lb-row" class:gold={i===0} class:silver={i===1} class:bronze={i===2}>
							<span class="lb-rank">#{i + 1}</span>
							<span class="lb-name">{e.name}</span>
							<span class="lb-score">{e.score}pts</span>
							<span class="lb-time">{fmtDate(e.date)}</span>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 200;
		padding: 16px;
		background: rgba(0,0,0,0.6);
		backdrop-filter: blur(4px);
		animation: fade-in 0.2s ease;
	}
	.panel {
		background: #24394f;
		border: 4px solid white;
		border-radius: 12px;
		padding: 20px;
		color: white;
		box-shadow: 0 8px 0 rgba(0,0,0,0.5), 0 24px 60px rgba(0,0,0,0.7);
		max-width: 540px;
		width: 100%;
		animation: pop-in 0.25s cubic-bezier(0.34,1.56,0.64,1);
	}
	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 16px;
	}
	.title {
		font-size: 18px;
		font-weight: 700;
	}
	.close-btn {
		background: rgba(255,255,255,0.1);
		border: none;
		color: rgba(255,255,255,0.7);
		width: 28px;
		height: 28px;
		border-radius: 6px;
		font-size: 13px;
		cursor: pointer;
		transition: background 0.12s;
	}
	.close-btn:hover { background: rgba(255,255,255,0.2); color: white; }

	.lb-tabs {
		display: flex;
		gap: 16px;
	}
	.lb-section { flex: 1; }
	.lb-divider {
		width: 1px;
		background: rgba(255,255,255,0.12);
		flex-shrink: 0;
	}
	.lb-head {
		font-size: 10px;
		color: rgba(255,255,255,0.4);
		letter-spacing: 0.1em;
		text-transform: uppercase;
		margin-bottom: 8px;
	}
	.lb-empty {
		font-size: 12px;
		color: rgba(255,255,255,0.3);
		padding: 8px 0;
	}
	.lb-row {
		display: flex;
		gap: 6px;
		align-items: center;
		font-size: 13px;
		padding: 5px 4px;
		border-radius: 5px;
		border-bottom: 1px solid rgba(255,255,255,0.07);
	}
	.lb-row.gold   { background: rgba(230,182,53,0.1); }
	.lb-row.silver { background: rgba(180,180,180,0.08); }
	.lb-row.bronze { background: rgba(180,100,50,0.08); }
	.lb-rank { color: rgba(255,255,255,0.35); width: 24px; font-size: 11px; }
	.lb-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.lb-score { font-variant-numeric: tabular-nums; color: #3ac961; font-weight: 700; white-space: nowrap; }
	.lb-time { color: rgba(255,255,255,0.35); font-size: 11px; white-space: nowrap; }

	@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
	@keyframes pop-in { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>

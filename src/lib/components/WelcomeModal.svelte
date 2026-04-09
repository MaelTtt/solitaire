<script lang="ts">
	import { todaySeed } from '$lib/game/seedRng';
	import { leaderboard, todayDate, fmtTime, seedLabel } from '$lib/stores/leaderboardStore.svelte';

	interface Props {
		onstart: (mode: 'daily' | 'random', seed: string) => void;
	}
	let { onstart }: Props = $props();

	const today = todayDate();
	const seed = todaySeed();

	const dailyBest = $derived(leaderboard.daily[0] ?? null);
	const allTimeBest = $derived(leaderboard.allTime[0] ?? null);

	function fmtDate(iso: string) {
		return new Date(iso + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}
</script>

<div class="overlay">
	<div class="panel">
		<div class="suit-row">♠ ♥ ♦ ♣</div>
		<h1>Solitaire</h1>
		<p class="date">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>

		<div class="modes">
			<button class="mode-btn daily" onclick={() => onstart('daily', seed)}>
				<span class="mode-icon">📅</span>
				<span class="mode-title">Partie du jour</span>
				<span class="mode-desc">Les mêmes cartes pour tous aujourd'hui</span>
				{#if dailyBest}
					<span class="mode-best">Meilleur aujourd'hui : {dailyBest.name} — {dailyBest.score}pts</span>
				{/if}
			</button>

			<button class="mode-btn random" onclick={() => onstart('random', `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)}>
				<span class="mode-icon">🎲</span>
				<span class="mode-title">Partie aléatoire</span>
				<span class="mode-desc">Nouveau mélange à chaque partie</span>
				{#if allTimeBest}
					<span class="mode-best">Meilleur total : {allTimeBest.name} — {allTimeBest.score}pts</span>
				{/if}
			</button>
		</div>

		{#if leaderboard.daily.length > 0 || leaderboard.allTime.length > 0}
			<details class="lb-preview">
				<summary>Classement</summary>
				<div class="lb-tabs">
					{#if leaderboard.daily.length > 0}
						<div class="lb-section">
							<div class="lb-head">Partie du jour</div>
							{#each leaderboard.daily.slice(0, 5) as e, i}
								<div class="lb-row">
									<span class="lb-rank">#{i + 1}</span>
									<span class="lb-name">{e.name}</span>
									<span class="lb-score">{e.score}</span>
									<span class="lb-time">{fmtTime(e.timeSeconds)}</span>
								</div>
							{/each}
						</div>
					{/if}
					{#if leaderboard.allTime.length > 0}
						<div class="lb-section">
							<div class="lb-head">Meilleur total</div>
							{#each leaderboard.allTime.slice(0, 5) as e, i}
								<div class="lb-row">
									<span class="lb-rank">#{i + 1}</span>
									<span class="lb-name">{e.name}<span class="lb-meta">{seedLabel(e)}</span></span>
									<span class="lb-score">{e.score}</span>
									<span class="lb-time">{fmtDate(e.date)}</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</details>
		{/if}
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
		max-width: 420px;
		width: 100%;
		animation: pop-in 0.35s cubic-bezier(0.34,1.56,0.64,1);
	}
	.suit-row {
		font-size: 20px;
		letter-spacing: 6px;
		opacity: 0.6;
		margin-bottom: 6px;
	}
	h1 {
		font-size: 32px;
		color: white;
		text-shadow: 0 5px 0 rgba(0,0,0,0.5);
		margin-bottom: 4px;
	}
	.date {
		font-size: 12px;
		color: rgba(255,255,255,0.45);
		margin-bottom: 20px;
	}
	.modes {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-bottom: 16px;
	}
	.mode-btn {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		padding: 14px 16px;
		border-radius: 8px;
		border: none;
		background: rgba(0,0,0,0.3);
		color: white;
		cursor: pointer;
		text-align: left;
		box-shadow: 0 4px 0 rgba(0,0,0,0.4);
		transition: transform 0.06s, box-shadow 0.06s;
	}
	.mode-btn:hover { transform: translateY(1px); box-shadow: 0 3px 0 rgba(0,0,0,0.4); }
	.mode-btn:active { transform: translateY(4px); box-shadow: 0 0 0 rgba(0,0,0,0.4); }
	.daily { background: rgba(58,201,97,0.2); box-shadow: 0 4px 0 #1a6a38; }
	.daily:hover { box-shadow: 0 3px 0 #1a6a38; }
	.daily:active { box-shadow: 0 0 0 #1a6a38; }
	.random { background: rgba(0,157,255,0.2); box-shadow: 0 4px 0 #005fa0; }
	.random:hover { box-shadow: 0 3px 0 #005fa0; }
	.random:active { box-shadow: 0 0 0 #005fa0; }
	.mode-icon { font-size: 20px; margin-bottom: 2px; }
	.mode-title { font-size: 16px; }
	.mode-desc { font-size: 12px; color: rgba(255,255,255,0.5); }
	.mode-best { font-size: 11px; color: rgba(255,255,255,0.55); margin-top: 3px; }

	.lb-preview { text-align: left; margin-top: 4px; }
	.lb-preview summary {
		cursor: pointer;
		font-size: 12px;
		color: rgba(255,255,255,0.4);
		text-align: center;
		list-style: none;
		padding: 6px;
		user-select: none;
	}
	.lb-preview summary:hover { color: rgba(255,255,255,0.7); }
	.lb-tabs { display: flex; gap: 16px; margin-top: 10px; flex-wrap: wrap; }
	.lb-section { flex: 1; min-width: 140px; }
	.lb-head { font-size: 11px; color: rgba(255,255,255,0.4); letter-spacing: 0.08em; margin-bottom: 6px; }
	.lb-row { display: flex; gap: 6px; align-items: center; font-size: 12px; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
	.lb-rank { color: rgba(255,255,255,0.35); width: 22px; }
	.lb-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.lb-name { display: flex; flex-direction: column; gap: 1px; white-space: normal; }
	.lb-meta { font-size: 10px; color: rgba(255,255,255,0.38); }
	.lb-score { font-variant-numeric: tabular-nums; color: #3ac961; }
	.lb-time { color: rgba(255,255,255,0.35); font-size: 11px; }

	@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
	@keyframes pop-in { from { transform: scale(0.88); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>

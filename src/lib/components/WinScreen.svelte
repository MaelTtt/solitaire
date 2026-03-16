<script lang="ts">
	import { gameStore } from '$lib/stores/gameStore.svelte';
	import { leaderboard, todayDate, fmtTime } from '$lib/stores/leaderboardStore.svelte';

	interface Props {
		finalScore: number;
		moves: number;
		startTime: number;
		endTime: number;
		onNewGame: (mode: 'daily' | 'random') => void;
	}
	let { finalScore, moves, startTime, endTime, onNewGame }: Props = $props();

	const elapsed = $derived(Math.floor((endTime - startTime) / 1000));
	const mode = $derived(gameStore.state.mode);
	const seed = $derived(gameStore.state.seed);

	let name = $state('');
	let submitted = $state(false);

	async function submit() {
		if (!name.trim()) return;
		submitted = true; // optimistic — show leaderboard immediately
		await leaderboard.submit({
			name: name.trim(),
			score: finalScore,
			moves,
			timeSeconds: elapsed,
			date: todayDate(),
			mode,
			seed
		});
	}

	const board = $derived(mode === 'daily' ? leaderboard.daily : leaderboard.allTime);
	const label = $derived(mode === 'daily' ? 'Classement du jour' : 'Classement général');
</script>

<div class="overlay">
	<div class="panel">
		<div class="title">Gagné ! 🎉</div>

		<div class="stats">
			<div class="stat-row"><span>Score</span><span class="val highlight">{finalScore}</span></div>
			<div class="stat-row"><span>Coups</span><span class="val">{moves}</span></div>
			<div class="stat-row"><span>Temps</span><span class="val">{fmtTime(elapsed)}</span></div>
			<div class="stat-row"><span>Mode</span><span class="val">{mode === 'daily' ? '📅 Quotidien' : '🎲 Aléatoire'}</span></div>
		</div>

		{#if !submitted}
			<div class="name-section">
				<label for="pname">Entrez votre nom pour le classement</label>
				<div class="name-row">
					<input
						id="pname"
						type="text"
						placeholder="Votre nom…"
						maxlength="20"
						bind:value={name}
						onkeydown={(e) => e.key === 'Enter' && submit()}
					/>
					<button class="submit-btn" onclick={submit} disabled={!name.trim()}>Valider</button>
				</div>
			</div>
		{:else}
			<div class="lb-panel">
				<div class="lb-title">{label}</div>
				{#each board.slice(0, 8) as e, i}
					<div class="lb-row" class:me={e.name === name && e.score === finalScore}>
						<span class="lb-rank">#{i + 1}</span>
						<span class="lb-name">{e.name}</span>
						<span class="lb-score">{e.score}</span>
						<span class="lb-time">{fmtTime(e.timeSeconds)}</span>
					</div>
				{/each}
			</div>
		{/if}

		<div class="actions">
			<button class="play-btn" onclick={() => onNewGame(mode)}>Rejouer</button>
			<button class="play-btn alt" onclick={() => onNewGame(mode === 'daily' ? 'random' : 'daily')}>
				{mode === 'daily' ? '🎲 Aléatoire' : '📅 Quotidien'}
			</button>
		</div>
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0,0,0,0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 16px;
		animation: fade-in 0.4s ease;
	}
	.panel {
		background: #24394f;
		border: 4px solid white;
		border-radius: 12px;
		padding: 24px 20px;
		text-align: center;
		color: white;
		box-shadow: 0 8px 0 rgba(0,0,0,0.5), 0 24px 60px rgba(0,0,0,0.7);
		max-width: 400px;
		width: 100%;
		animation: pop-in 0.4s cubic-bezier(0.34,1.56,0.64,1);
	}
	.title { font-size: 32px; text-shadow: 0 4px 0 rgba(0,0,0,0.5); margin-bottom: 16px; }

	/* Stats as inner-desc boxes */
	.stats {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		margin-bottom: 20px;
	}
	.stat-row {
		background: white;
		border-radius: 8px;
		box-shadow: 0 4px 0 #888;
		padding: 8px 10px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}
	.stat-row > span:first-child { font-size: 10px; color: rgba(0,0,0,0.4); letter-spacing: 0.08em; }
	.val { font-size: 15px; color: #0a0f14; font-variant-numeric: tabular-nums; }
	.highlight { color: #3ac961; font-size: 18px; }

	.name-section { margin-bottom: 16px; text-align: left; }
	.name-section label { font-size: 12px; color: rgba(255,255,255,0.45); display: block; margin-bottom: 8px; }
	.name-row { display: flex; gap: 8px; }
	input {
		flex: 1;
		padding: 9px 12px;
		border-radius: 6px;
		border: 3px solid rgba(255,255,255,0.3);
		background: rgba(0,0,0,0.3);
		color: white;
		font-size: 14px;
		font-family: inherit;
		outline: none;
	}
	input:focus { border-color: white; }
	.submit-btn {
		padding: 9px 16px;
		border-radius: 6px;
		background: #3ac961;
		border: none;
		color: white;
		font-family: inherit;
		font-size: 13px;
		cursor: pointer;
		box-shadow: 0 4px 0 #1a6a38;
		transition: transform 0.06s, box-shadow 0.06s;
	}
	.submit-btn:hover:not(:disabled) { transform: translateY(1px); box-shadow: 0 3px 0 #1a6a38; }
	.submit-btn:active:not(:disabled) { transform: translateY(4px); box-shadow: 0 0 0 #1a6a38; }
	.submit-btn:disabled { opacity: 0.35; cursor: not-allowed; }

	.lb-panel { text-align: left; margin-bottom: 16px; }
	.lb-title { font-size: 11px; color: rgba(255,255,255,0.4); letter-spacing: 0.08em; margin-bottom: 8px; text-align: center; }
	.lb-row { display: flex; gap: 8px; align-items: center; font-size: 13px; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
	.lb-row.me { background: rgba(58,201,97,0.12); border-radius: 4px; padding: 5px 6px; }
	.lb-rank { color: rgba(255,255,255,0.35); width: 24px; }
	.lb-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.lb-score { color: #3ac961; font-variant-numeric: tabular-nums; }
	.lb-time { color: rgba(255,255,255,0.35); font-size: 11px; width: 40px; text-align: right; }

	.actions { display: flex; gap: 10px; justify-content: center; }
	.play-btn {
		padding: 10px 22px;
		border-radius: 6px;
		background: #3ac961;
		border: none;
		color: white;
		font-size: 13px;
		font-family: inherit;
		cursor: pointer;
		box-shadow: 0 4px 0 #1a6a38;
		transition: transform 0.06s, box-shadow 0.06s;
	}
	.play-btn:hover { transform: translateY(1px); box-shadow: 0 3px 0 #1a6a38; }
	.play-btn:active { transform: translateY(4px); box-shadow: 0 0 0 #1a6a38; }
	.play-btn.alt {
		background: rgba(0,157,255,0.25);
		box-shadow: 0 4px 0 #005fa0;
	}
	.play-btn.alt:hover { box-shadow: 0 3px 0 #005fa0; }
	.play-btn.alt:active { box-shadow: 0 0 0 #005fa0; }

	@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
	@keyframes pop-in { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>

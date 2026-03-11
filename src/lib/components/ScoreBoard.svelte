<script lang="ts">
	interface Props { score: number; moves: number; startTime: number; }
	let { score, moves, startTime }: Props = $props();

	let elapsed = $state(0);
	$effect(() => {
		const iv = setInterval(() => { elapsed = Math.floor((Date.now() - startTime) / 1000); }, 1000);
		return () => clearInterval(iv);
	});

	function fmt(s: number) {
		return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
	}
</script>

<div class="scoreboard">
	<div class="chip score-chip">
		<span class="chip-icon">$</span>
		<span class="chip-val">{score}</span>
	</div>
	<div class="stats">
		<div class="stat"><span class="lbl">MOVES</span><span class="val">{moves}</span></div>
		<div class="divider"></div>
		<div class="stat"><span class="lbl">TIME</span><span class="val">{fmt(elapsed)}</span></div>
	</div>
</div>

<style>
	.scoreboard { display: flex; align-items: center; gap: 16px; }

	.chip {
		display: flex;
		align-items: center;
		gap: 6px;
		background: linear-gradient(135deg, #c8a846 0%, #a07830 100%);
		border-radius: 999px;
		padding: 6px 14px 6px 10px;
		box-shadow: 0 2px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2);
		border: 1px solid rgba(200,168,70,0.6);
	}
	.chip-icon {
		font-size: 14px;
		font-weight: 900;
		color: #3d2a00;
		background: rgba(0,0,0,0.2);
		border-radius: 50%;
		width: 22px;
		height: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.chip-val {
		font-size: 18px;
		font-weight: 900;
		color: #1a0f00;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
		text-shadow: 0 1px 0 rgba(255,255,255,0.3);
	}

	.stats { display: flex; align-items: center; gap: 10px; }
	.divider { width: 1px; height: 24px; background: rgba(255,255,255,0.15); }
	.stat { display: flex; flex-direction: column; align-items: center; gap: 1px; }
	.lbl { font-size: 9px; letter-spacing: 0.1em; opacity: 0.45; color: white; }
	.val { font-size: 16px; font-weight: 800; color: white; font-variant-numeric: tabular-nums; }
</style>

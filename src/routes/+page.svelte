<script lang="ts">
	import { onMount } from 'svelte';
	import { gameStore } from '$lib/stores/gameStore.svelte';
	import { dragState } from '$lib/utils/dragState.svelte';
	import { screen } from '$lib/stores/screenStore.svelte';
	import { canMoveToFoundation, canMoveToTableau } from '$lib/game/rules';
	import { fmtTime } from '$lib/stores/leaderboardStore.svelte';
	import { todaySeed } from '$lib/game/seedRng';
	import type { PileLocation } from '$lib/game/types';
	import TableauPile from '$lib/components/TableauPile.svelte';
	import FoundationPile from '$lib/components/FoundationPile.svelte';
	import StockPile from '$lib/components/StockPile.svelte';
	import WastePile from '$lib/components/WastePile.svelte';
	import CardStack from '$lib/components/CardStack.svelte';
	import WinScreen from '$lib/components/WinScreen.svelte';
	import StuckScreen from '$lib/components/StuckScreen.svelte';
	import WelcomeModal from '$lib/components/WelcomeModal.svelte';
	import LeaderboardModal from '$lib/components/LeaderboardModal.svelte';
	import VortexBackground from '$lib/components/VortexBackground.svelte';

	// Load saved game synchronously before first render to avoid flash of wrong state
	// Safe because SSR is disabled (ssr = false) — localStorage is always available here
	let _initialShowModal = true;
	try {
		const loaded = gameStore.loadSaved();
		if (loaded) {
			if (gameStore.state.mode === 'daily' && gameStore.state.seed !== todaySeed()) {
				// Stale daily game from a previous day — discard it, show welcome modal
				gameStore.clearSaved();
			} else {
				_initialShowModal = false;
			}
		}
	} catch {}

	onMount(() => {
		screen.init();
		// Handle fullscreen change events
		document.addEventListener('fullscreenchange', () => { isFullscreen = !!document.fullscreenElement; });
		document.addEventListener('webkitfullscreenchange', () => { isFullscreen = !!(document as any).webkitFullscreenElement; });
		const playSeed = (event: Event) => {
			const seed = (event as CustomEvent<string>).detail;
			if (seed) startGame('random', seed);
		};
		window.addEventListener('play-seed', playSeed as EventListener);
		return () => window.removeEventListener('play-seed', playSeed as EventListener);
	});

	const gs = gameStore;
	let showModal = $state(_initialShowModal);
	let isFullscreen = $state(false);

	async function toggleFullscreen() {
		try {
			const docEl = document.documentElement as any;
			if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
				await (docEl.requestFullscreen ?? docEl.webkitRequestFullscreen ?? (() => {})).call(docEl);
			} else {
				await (document.exitFullscreen ?? (document as any).webkitExitFullscreen ?? (() => {})).call(document);
			}
		} catch {}
	}
	let showLeaderboard = $state(false);
	let elapsed = $state(0);

	$effect(() => {
		const iv = setInterval(() => { elapsed = Math.floor((Date.now() - gs.state.startTime) / 1000); }, 1000);
		return () => clearInterval(iv);
	});

	function startGame(mode: 'daily' | 'random', seed: string) {
		gs.newGame(gs.state.drawMode, mode, seed);
		showModal = false;
	}

	function onNewGame(mode: 'daily' | 'random') {
		gs.newGame(gs.state.drawMode, mode, mode === 'daily' ? todaySeed() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
	}

	let dropTarget = $state<PileLocation | null>(null);

	function isDropTarget(type: PileLocation['type'], index: number) {
		return dropTarget?.type === type && dropTarget?.index === index;
	}

	function onPointermove(e: PointerEvent) {
		if (!dragState.active) return;
		dragState.move(e.clientX, e.clientY);
		const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
		const pileEl = el?.closest('[data-pile-type]') as HTMLElement | null;
		if (!pileEl) { dropTarget = null; return; }
		const ptype = pileEl.dataset.pileType as PileLocation['type'];
		const pidx = Number(pileEl.dataset.pileIndex ?? 0);
		const cards = dragState.cards;
		if (!cards.length) { dropTarget = null; return; }
		const state = gs.state;
		let valid = false;
		if (ptype === 'foundation' && cards.length === 1) valid = canMoveToFoundation(cards[0], state.foundations[pidx]);
		else if (ptype === 'tableau') valid = canMoveToTableau(cards[0], state.tableau[pidx]);
		dropTarget = valid ? { type: ptype, index: pidx } : null;
	}

	function onPointerup() {
		if (!dragState.active) return;
		if (dropTarget && dragState.from) gs.moveCards(dragState.from, dropTarget, dragState.cards[0]?.id);
		dropTarget = null;
		dragState.end();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'n' || e.key === 'N') showModal = true;
		if ((e.ctrlKey || e.metaKey) && e.key === 'z') gs.undo();
		if ((e.key === 'h' || e.key === 'H') && !e.repeat) gs.showHint();
	}

	const hintedCardId = $derived(gs.hint?.cardId ?? null);
	const hintStock = $derived(gs.hint?.from.type === 'stock');
	const finalScore = $derived(gs.won ? gs.getFinalScore() : 0);
	const ghostStyle = $derived(
		`left:${dragState.x}px;top:${dragState.y}px;transform:translate(${-screen.cardW/2}px,-20px)`
	);

	const foundationTotal = $derived(
		gs.state.foundations.reduce((sum, f) => sum + f.length, 0)
	);
	const SUITS = ['♠','♥','♦','♣'] as const;
	const SUIT_COLORS = ['#c8b8ff','#ff6b8a','#ffaa55','#6bdd8a'] as const;
</script>

<svelte:window
	onkeydown={onKeydown}
	onpointermove={onPointermove}
	onpointerup={onPointerup}
	onpointercancel={() => { dropTarget = null; dragState.end(); }}
/>

<VortexBackground />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="root">

	<!-- ─── TOP BAR ─────────────────────────────── -->
	<header class="top-bar">
		<div class="bar-logo">♠</div>

		<div class="bar-sep"></div>

		<div class="mode-badge" class:daily={gs.state.mode === 'daily'}>
			{gs.state.mode === 'daily' ? '📅 Quotidien' : '🎲 Aléatoire'}
		</div>

		<div class="bar-sep"></div>

		<div class="bar-stats-group">
			<div class="bar-stat">
				<span class="bar-lbl">SCORE</span>
				<span class="bar-val">{gs.state.score}</span>
			</div>
			<div class="bar-stat">
				<span class="bar-lbl">COUPS</span>
				<span class="bar-val">{gs.state.moves}</span>
			</div>
			<div class="bar-stat">
				<span class="bar-lbl">TEMPS</span>
				<span class="bar-val">{fmtTime(elapsed)}</span>
			</div>
		</div>

		<div class="bar-sep"></div>

		<div class="bar-progress-widget">
			<div class="bar-suits">
				{#each gs.state.foundations as pile, i}
					<div class="bar-suit" style="color:{SUIT_COLORS[i]}">{SUITS[i]}<span>{pile.length}</span></div>
				{/each}
			</div>
			<div class="found-bar">
				<div class="found-fill" style="width:{(foundationTotal/52)*100}%"></div>
			</div>
		</div>

		<div class="bar-spacer"></div>

		<div class="bar-actions">
			<button class="act-btn fs-btn" title="Plein écran" onclick={toggleFullscreen}>
				{#if isFullscreen}
					<!-- Compress / exit fullscreen -->
					<svg viewBox="0 0 18 18" fill="currentColor" width="18" height="18">
						<path d="M6 1v4H2V3h2V1h2zm6 0h2v2h2v2h-4V1zM2 12h4v4H4v-2H2v-2zm10 2v2h-2v-4h4v2h-2z"/>
					</svg>
				{:else}
					<!-- Expand / enter fullscreen -->
					<svg viewBox="0 0 18 18" fill="currentColor" width="18" height="18">
						<path d="M1 1h5v2H3v2H1V1zm11 0h5v5h-2V3h-3V1zM1 12h2v2h3v2H1v-4zm13 2h-3v2h5v-4h-2v2z"/>
					</svg>
				{/if}
			</button>
			<button class="act-btn lb-btn" title="Classement" onclick={() => showLeaderboard = true}>
				<!-- Trophy -->
				<svg viewBox="0 0 18 18" fill="currentColor" width="18" height="18">
					<path d="M3 2h12v1H3V2zm1 1h10v6c0 2.5-2 4-5 4S4 11.5 4 9V3zm-2 1H1v3c0 1.5 1 2.5 2.5 2.8V4zm13 0h-1v5.8C16.5 9.5 17 8.5 17 7V4h-1zM7.5 13V14H6v1h1v1h4v-1h1v-1H10v-1H7.5zM6 16h6v1H6v-1z"/>
				</svg>
			</button>
			<button class="act-btn hint-btn" title="Indice (H)" onclick={() => gs.showHint()} disabled={gs.autoCompleting}>
				<!-- Lightbulb -->
				<svg viewBox="0 0 18 18" fill="currentColor" width="18" height="18">
					<path d="M9 1C6.2 1 4 3.2 4 6c0 2.3 1.4 4.2 3.5 5V13h3v-2c2.1-.8 3.5-2.7 3.5-5 0-2.8-2.2-5-5-5zM7 15h4v1H7v-1zm1 2h2v1H8v-1z"/>
				</svg>
			</button>
			<button class="act-btn undo-btn" title="Annuler (Ctrl+Z)" disabled={gs.undoStack.length === 0} onclick={() => gs.undo()}>
				<!-- Rotate-left (undo) arrow -->
				<svg viewBox="0 0 18 18" fill="currentColor" width="18" height="18">
					<path d="M3 9.5L7.5 5v3C11.5 8 15 9.5 15 13c0-3-3.5-4-7.5-4V12L3 9.5z"/>
				</svg>
			</button>
			<button class="act-btn new-btn" onclick={() => showModal = true}>
				<span class="btn-label-full">Nouvelle partie</span>
				<span class="btn-label-short">+</span>
			</button>
		</div>
	</header>

	<!-- ─── BOARD ───────────────────────────────── -->
	<div class="board-wrap">
		<main class="board" style="--tableau-scale:{screen.tableauScale}">
			<section class="top-row">
				<StockPile cards={gs.state.stock} hinted={hintStock} />
				<WastePile cards={gs.state.waste} drawMode={gs.state.drawMode} hintedCardId={hintedCardId} />
				<div class="gap"></div>
				{#each gs.state.foundations as pile, i}
					<div data-pile-type="foundation" data-pile-index={i}>
						<FoundationPile cards={pile} index={i} isDropTarget={isDropTarget('foundation', i)} />
					</div>
				{/each}
			</section>

			<section class="tableau-row">
				{#each gs.state.tableau as pile, i}
					<div data-pile-type="tableau" data-pile-index={i} class="tableau-col">
						<TableauPile cards={pile} index={i} hintedCardId={hintedCardId} isDropTarget={isDropTarget('tableau', i)} />
					</div>
				{/each}
			</section>
		</main>
	</div>

	<!-- Drag ghost -->
	{#if dragState.active && dragState.cards.length > 0}
		<div class="drag-ghost" style={ghostStyle}>
			<CardStack cards={dragState.cards} tilt={dragState.tilt} />
		</div>
	{/if}

	<!-- Overlays -->
	{#if gs.stuck && !gs.won}
		<StuckScreen onNewGame={() => showModal = true} />
	{/if}
	{#if gs.won && gs.state.endTime}
		<WinScreen finalScore={finalScore} moves={gs.state.moves} startTime={gs.state.startTime} endTime={gs.state.endTime} onNewGame={onNewGame} />
	{/if}

	<!-- Mobile bottom action bar (portrait only) -->
	<footer class="mob-bottom">
		<button class="mob-btn mob-undo" disabled={gs.undoStack.length === 0} onclick={() => gs.undo()}>
			<svg viewBox="0 0 18 18" fill="currentColor" width="15" height="15" style="flex-shrink:0">
				<path d="M3 9.5L7.5 5v3C11.5 8 15 9.5 15 13c0-3-3.5-4-7.5-4V12L3 9.5z"/>
			</svg>
			Annuler
		</button>
		<button class="mob-btn mob-new" onclick={() => showModal = true}>
			+ Nouvelle partie
		</button>
	</footer>
</div>

{#if showModal}
	<WelcomeModal onstart={startGame} />
{/if}

{#if showLeaderboard}
	<LeaderboardModal onclose={() => showLeaderboard = false} />
{/if}

<style>
	.root {
		height: 100dvh;
		display: flex;
		flex-direction: column;
		position: relative;
		z-index: 1;
		touch-action: none;
		user-select: none;
		overflow: hidden;
	}

	/* ─── TOP BAR ─── */
	.top-bar {
		min-height: calc(50px + env(safe-area-inset-top, 0px));
		flex-shrink: 0;
		background: var(--bal-panel);
		border-bottom: 3px solid white;
		box-shadow: 0 4px 0 rgba(0,0,0,0.5);
		display: flex;
		align-items: center;
		gap: 10px;
		padding-top: env(safe-area-inset-top, 0px);
		padding-bottom: 4px;
		padding-left: calc(14px + env(safe-area-inset-left, 0px));
		padding-right: calc(14px + env(safe-area-inset-right, 0px));
		overflow: hidden;
	}

	.bar-logo {
		font-size: 26px;
		color: white;
		flex-shrink: 0;
		line-height: 1;
		text-shadow: 0 3px 0 rgba(0,0,0,0.6);
	}

	.bar-sep {
		width: 2px;
		height: 32px;
		background: rgba(255,255,255,0.2);
		flex-shrink: 0;
	}

	.bar-spacer { flex: 1; }

	.mode-badge {
		font-size: 13px;
		padding: 4px 9px;
		border-radius: 5px;
		background: rgba(0,0,0,0.3);
		border: 2px solid rgba(255,255,255,0.25);
		color: rgba(255,255,255,0.75);
		box-shadow: 0 3px 0 rgba(0,0,0,0.4);
		flex-shrink: 0;
		white-space: nowrap;
	}
	.mode-badge.daily {
		border-color: var(--bal-gold);
		color: var(--bal-gold);
		box-shadow: 0 3px 0 #7a5c00;
	}

	/* Stats group — each stat is a small Balatro-style inner card */
	.bar-stats-group {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}
	.bar-stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0;
		background: rgba(0,0,0,0.3);
		border: 2px solid rgba(255,255,255,0.2);
		border-radius: 5px;
		padding: 3px 10px;
		box-shadow: 0 3px 0 rgba(0,0,0,0.5);
	}
	.bar-lbl {
		font-size: 9px;
		color: rgba(255,255,255,0.4);
		letter-spacing: 0.1em;
	}
	.bar-val {
		font-size: 17px;
		color: white;
		font-variant-numeric: tabular-nums;
		line-height: 1.1;
	}

	/* Foundation progress widget */
	.bar-progress-widget {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex-shrink: 0;
	}
	.bar-suits {
		display: flex;
		gap: 8px;
	}
	.bar-suit {
		display: flex;
		align-items: center;
		gap: 2px;
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.bar-suit span {
		font-size: 11px;
		color: rgba(255,255,255,0.55);
	}
	.found-bar {
		height: 5px;
		background: rgba(0,0,0,0.4);
		border: 1px solid rgba(255,255,255,0.15);
		border-radius: 3px;
		overflow: hidden;
	}
	.found-fill {
		height: 100%;
		background: var(--bal-green);
		transition: width 0.3s ease;
	}

	/* Actions */
	.bar-actions {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}
	.act-btn {
		height: 34px;
		padding: 0 12px;
		border-radius: 5px;
		border: none;
		font-size: 14px;
		font-family: inherit;
		cursor: pointer;
		transition: transform 0.06s, box-shadow 0.06s;
		white-space: nowrap;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.act-btn:hover:not(:disabled) { transform: translateY(1px); }
	.act-btn:active:not(:disabled) { transform: translateY(3px); }
	.act-btn:disabled { opacity: 0.25; cursor: not-allowed; }

	.lb-btn {
		background: rgba(230,182,53,0.2);
		color: var(--bal-gold);
		border: 2px solid var(--bal-gold);
		box-shadow: 0 3px 0 #7a5c00;
		width: 34px; padding: 0;
	}
	.lb-btn:active:not(:disabled) { box-shadow: none; }

	.hint-btn {
		background: var(--bal-green);
		color: white;
		border: 2px solid white;
		box-shadow: 0 3px 0 #1a6a38;
		width: 34px; padding: 0;
	}
	.hint-btn:active:not(:disabled) { box-shadow: none; }

	.undo-btn {
		background: rgba(255,255,255,0.12);
		color: white;
		border: 2px solid rgba(255,255,255,0.3);
		box-shadow: 0 3px 0 rgba(0,0,0,0.5);
		width: 34px; padding: 0;
		font-size: 17px;
	}
	.undo-btn:active:not(:disabled) { box-shadow: none; }

	.new-btn {
		background: var(--bal-blue);
		color: white;
		border: 2px solid white;
		box-shadow: 0 3px 0 #005fa0;
		padding: 0 14px;
		font-size: 13px;
	}
	.new-btn:active:not(:disabled) { box-shadow: none; }

	.fs-btn {
		background: rgba(255,255,255,0.1);
		color: white;
		border: 2px solid rgba(255,255,255,0.3);
		box-shadow: 0 3px 0 rgba(0,0,0,0.5);
		width: 34px; padding: 0;
		font-size: 20px;
		font-family: system-ui, sans-serif;
		line-height: 1;
	}
	.fs-btn:active:not(:disabled) { box-shadow: none; }

	.btn-label-short { display: none; }
	.btn-label-full  { display: inline; }

	/* ─── MOBILE BOTTOM BAR ─── */
	.mob-bottom {
		display: none;
		flex-shrink: 0;
		background: transparent;
		padding: 8px 12px calc(8px + env(safe-area-inset-bottom, 0px));
		justify-content: space-between;
		align-items: center;
		gap: 8px;
	}
	.mob-btn {
		height: 42px;
		border-radius: 7px;
		border: 2px solid rgba(255,255,255,0.35);
		font-size: 14px;
		font-family: inherit;
		cursor: pointer;
		padding: 0 18px;
		color: white;
		background: rgba(0,0,0,0.35);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		transition: transform 0.06s, opacity 0.06s;
		display: flex;
		align-items: center;
		justify-content: center;
		white-space: nowrap;
	}
	.mob-btn:active:not(:disabled) { transform: translateY(2px); opacity: 0.8; }
	.mob-btn:disabled { opacity: 0.25; cursor: not-allowed; }
	.mob-undo { gap: 6px; }
	.mob-new {
		background: var(--bal-blue);
		border-color: white;
		box-shadow: 0 3px 0 #005fa0;
	}
	.mob-new:active:not(:disabled) { box-shadow: none; }

	/* ─── BOARD ─── */
	.board-wrap {
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: 16px;
		padding-left: env(safe-area-inset-left, 0px);
		padding-right: env(safe-area-inset-right, 0px);
		overflow: hidden;
	}
	.board {
		padding: var(--board-pad, 14px);
		display: flex;
		flex-direction: column;
		gap: var(--col-gap, 8px);
		width: calc(7 * var(--card-w, 80px) + 6 * var(--col-gap, 8px) + 2 * var(--board-pad, 14px));
		max-width: 100%;
	}
	.top-row    { display: flex; align-items: flex-start; gap: var(--col-gap, 8px); }
	.gap        { flex: 1; }
	.tableau-row { display: flex; align-items: flex-start; gap: var(--col-gap, 8px); }
	.tableau-col { flex: 1; min-width: 0; }
	.tableau-row {
		transform: scale(var(--tableau-scale, 1));
		transform-origin: top center;
	}

	.drag-ghost {
		position: fixed;
		pointer-events: none;
		z-index: 9999;
	}

	/* ─── MOBILE: portrait (narrow screens) ─── */
	@media (max-width: 480px) {
		.top-bar { gap: 5px; padding-left: calc(8px + env(safe-area-inset-left, 0px)); padding-right: calc(8px + env(safe-area-inset-right, 0px)); }
		.bar-logo { display: none; }
		.bar-sep  { display: none; }
		.bar-progress-widget { display: none; }
		.mode-badge { font-size: 11px; padding: 3px 5px; }
		.bar-stats-group { gap: 3px; }
		.bar-stat { padding: 2px 6px; }
		.bar-lbl  { font-size: 8px; }
		.bar-val  { font-size: 14px; }
		.act-btn  { height: 30px; }
		.fs-btn, .lb-btn, .hint-btn { width: 30px; font-size: 15px; }
		/* Move undo + new game to bottom bar on portrait */
		.top-bar .undo-btn { display: none; }
		.top-bar .new-btn  { display: none; }
		.bar-actions { gap: 4px; }
		.board-wrap { padding-top: 6px; }
		.mob-bottom { display: flex; }
	}

	/* ─── MOBILE: landscape (short screens) ─── */
	@media (max-height: 450px) {
		.top-bar { min-height: calc(42px + env(safe-area-inset-top, 0px)); padding-top: env(safe-area-inset-top, 0px); padding-bottom: 3px; padding-left: calc(8px + env(safe-area-inset-left, 0px)); padding-right: calc(8px + env(safe-area-inset-right, 0px)); gap: 5px; }
		.bar-logo { display: none; }
		.bar-sep  { display: none; }
		.bar-progress-widget { display: none; }
		.mode-badge { display: none; }
		.bar-stat { padding: 1px 5px; }
		.bar-lbl  { font-size: 7px; }
		.bar-val  { font-size: 12px; }
		.act-btn  { height: 26px; font-size: 12px; }
		.fs-btn, .lb-btn, .hint-btn, .undo-btn { width: 26px; }
		.btn-label-full  { display: none; }
		.btn-label-short { display: inline; font-size: 16px; font-weight: bold; }
		.new-btn { width: 30px; padding: 0; }
		.bar-actions { gap: 3px; }
		.board-wrap { padding-top: 4px; }
		.mob-bottom { display: none !important; }
	}
</style>

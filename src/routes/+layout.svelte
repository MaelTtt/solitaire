<script lang="ts">
	let { children } = $props();
</script>

<svelte:head>
	<title>Solitaire</title>
	<meta name="description" content="Klondike Solitaire" />
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
</svelte:head>

{@render children()}

<style>
	@font-face {
		font-family: 'm6x11plus';
		src: url('https://files.catbox.moe/cdr5ds.ttf');
		font-display: swap;
	}
	:global(*, *::before, *::after) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}
	:global(:root) {
		--color-card-back: #0f2461;
		--color-red: #ff4444;
		--card-radius: 6px;
		/* card-w, card-h, col-gap, board-pad set by screenStore at runtime */
		--card-w: 80px;
		--card-h: 112px;
		--col-gap: 8px;
		--board-pad: 16px;
		/* Balatro palette */
		--bal-panel: #24394f;
		--bal-inner: #ffffff;
		--bal-gold: #e6b635;
		--bal-red: #ff4444;
		--bal-blue: #009dff;
		--bal-green: #3ac961;
	}
	:global(html) { background: #0a160e; }
	:global(body) {
		background: transparent;
		font-family: 'm6x11plus', monospace, system-ui, sans-serif;
		min-height: 100dvh;
		overflow: hidden;
	}
	:global(button) { font-family: inherit; }
</style>

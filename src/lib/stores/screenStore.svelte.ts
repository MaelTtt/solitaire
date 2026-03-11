// Computes responsive card/gap sizes from viewport dimensions, sets CSS vars

export const TOPBAR_H = 64; // px — matches .top-bar height in +page.svelte

let _cardW = $state(80);
let _cardH = $state(112);
let _colGap = $state(8);
let _faceUpOffset = $state(28);
let _faceDownOffset = $state(18);
let _wasteOffset = $state(18);

function compute() {
	if (typeof window === 'undefined') return;
	const vw = window.innerWidth;
	const vh = window.innerHeight - TOPBAR_H;
	const pad = Math.max(6, Math.min(18, vw * 0.014));
	const gap = Math.max(3, Math.min(10, vw * 0.007));

	// Width: fit 7 columns
	const rawW = (vw - 2 * pad - 6 * gap) / 7;

	// Height: fit top-row + tableau (assume ~6 face-up cards visible per column)
	// total_h = 2*pad + gap + card_h*(1 + 2.5) = 2*pad + gap + 3.5*h = 2*pad + gap + 3.5*(w*1.4)
	// → w ≤ (vh - 2*pad - gap) / (3.5 * 1.4)
	const rawH = (vh - 2 * pad - gap) / (2.8 * 1.4);

	const w = Math.max(42, Math.min(120, Math.floor(Math.min(rawW, rawH))));
	const h = Math.floor(w * 1.4);

	_cardW = w;
	_cardH = h;
	_colGap = gap;
	_faceUpOffset = Math.max(14, Math.floor(h * 0.25));
	_faceDownOffset = Math.max(8, Math.floor(h * 0.16));
	_wasteOffset = Math.max(10, Math.floor(w * 0.22));

	const r = document.documentElement;
	r.style.setProperty('--card-w', w + 'px');
	r.style.setProperty('--card-h', h + 'px');
	r.style.setProperty('--col-gap', gap + 'px');
	r.style.setProperty('--board-pad', pad + 'px');
}

// Re-run on every HMR save
if (typeof window !== 'undefined') compute();

export const screen = {
	get cardW() { return _cardW; },
	get cardH() { return _cardH; },
	get colGap() { return _colGap; },
	get faceUpOffset() { return _faceUpOffset; },
	get faceDownOffset() { return _faceDownOffset; },
	get wasteOffset() { return _wasteOffset; },

	init() {
		compute();
		window.addEventListener('resize', compute, { passive: true });
	}
};

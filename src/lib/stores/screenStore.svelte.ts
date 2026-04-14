// Computes responsive card/gap sizes from viewport dimensions, sets CSS vars

export const TOPBAR_H = 58; // px — fallback, actual height read dynamically

let _cardW = $state(80);
let _cardH = $state(112);
let _colGap = $state(8);
let _faceUpOffset = $state(28);
let _faceDownOffset = $state(18);
let _wasteOffset = $state(18);
let _tableauScale = $state(1);

// Maximum card width on large/HiDPI desktop screens (CSS px — already device-independent)
const MAX_CARD_W = 130;

function compute() {
	if (typeof window === 'undefined') return;
	const vw = window.innerWidth;
	// Read actual topbar height if available (accounts for safe-area-inset-top)
	const topbarEl = document.querySelector('.top-bar') as HTMLElement | null;
	const topbarH = topbarEl ? topbarEl.offsetHeight : TOPBAR_H;
	const vh = window.innerHeight - topbarH;
	const pad = Math.max(4, Math.min(14, vw * 0.012));
	const gap = Math.max(3, Math.min(8, vw * 0.006));

	// Width: fit 7 columns
	const rawW = (vw - 2 * pad - 6 * gap) / 7;

	// Height: card must leave room for top row + tableau with ~5 face-up cards visible
	// top row = 1 card height, tableau = card height + 5 * faceUpOffset ≈ card height * (1 + 5*0.28)
	// Total ≈ card height * 3.4  →  maxH = vh / 3.4
	const rawH = vh / 3.4;

	const w = Math.max(38, Math.floor(Math.min(rawW, rawH, MAX_CARD_W)));
	const h = Math.floor(w * 1.4);

	_cardW = w;
	_cardH = h;
	_colGap = gap;
	_faceUpOffset = Math.max(12, Math.floor(h * 0.24));
	_faceDownOffset = Math.max(7, Math.floor(h * 0.15));
	_wasteOffset = Math.max(9, Math.floor(w * 0.22));
	_tableauScale = 1;

	const r = document.documentElement;
	r.style.setProperty('--card-w', w + 'px');
	r.style.setProperty('--card-h', h + 'px');
	r.style.setProperty('--col-gap', gap + 'px');
	r.style.setProperty('--board-pad', pad + 'px');
	r.style.setProperty('--face-up-offset', _faceUpOffset + 'px');
	r.style.setProperty('--tableau-scale', String(_tableauScale));
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
	get tableauScale() { return _tableauScale; },

	init() {
		compute();
		window.addEventListener('resize', compute, { passive: true });
		// Handle orientation changes (fired before resize on some mobile browsers)
		window.addEventListener('orientationchange', () => setTimeout(compute, 50), { passive: true });
		if (typeof window.screen !== 'undefined' && 'orientation' in window.screen) {
			(window.screen as any).orientation?.addEventListener('change', () => setTimeout(compute, 50));
		}
	}
};

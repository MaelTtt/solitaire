import { useEffect, useState } from 'preact/hooks';

export interface ScreenMetrics {
	cardW: number;
	cardH: number;
	colGap: number;
	faceUpOffset: number;
	faceDownOffset: number;
	wasteOffset: number;
}

const DEFAULT: ScreenMetrics = {
	cardW: 80,
	cardH: 112,
	colGap: 8,
	faceUpOffset: 28,
	faceDownOffset: 18,
	wasteOffset: 18
};

const MAX_CARD_W = 130;

export function useScreenMetrics(): ScreenMetrics {
	const [metrics, setMetrics] = useState<ScreenMetrics>(DEFAULT);

	useEffect(() => {
		const compute = () => setMetrics(computeScreenMetrics());
		compute();
		window.addEventListener('resize', compute, { passive: true });
		window.addEventListener('orientationchange', compute, { passive: true });
		return () => {
			window.removeEventListener('resize', compute);
			window.removeEventListener('orientationchange', compute);
		};
	}, []);

	useEffect(() => applyMetrics(metrics), [metrics]);

	return metrics;
}

function computeScreenMetrics(): ScreenMetrics {
	const vw = window.innerWidth;
	const topbarEl = document.querySelector('.top-bar') as HTMLElement | null;
	const topbarH = topbarEl ? topbarEl.offsetHeight : 58;
	const vh = window.innerHeight - topbarH;
	const pad = Math.max(4, Math.min(14, vw * 0.012));
	const gap = Math.max(3, Math.min(8, vw * 0.006));
	const rawW = (vw - 2 * pad - 6 * gap) / 7;
	const rawH = vh / 3.4;
	const cardW = Math.max(38, Math.floor(Math.min(rawW, rawH, MAX_CARD_W)));
	const cardH = Math.floor(cardW * 1.4);
	return {
		cardW,
		cardH,
		colGap: gap,
		faceUpOffset: Math.max(12, Math.floor(cardH * 0.24)),
		faceDownOffset: Math.max(7, Math.floor(cardH * 0.15)),
		wasteOffset: Math.max(9, Math.floor(cardW * 0.22))
	};
}

function applyMetrics(metrics: ScreenMetrics): void {
	const root = document.documentElement;
	const pad = Math.max(4, Math.min(14, window.innerWidth * 0.012));
	root.style.setProperty('--card-w', `${metrics.cardW}px`);
	root.style.setProperty('--card-h', `${metrics.cardH}px`);
	root.style.setProperty('--col-gap', `${metrics.colGap}px`);
	root.style.setProperty('--board-pad', `${pad}px`);
	root.style.setProperty('--face-up-offset', `${metrics.faceUpOffset}px`);
}

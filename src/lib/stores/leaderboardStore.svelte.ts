const LOCAL_KEY = 'solitaire_lb_v1';
const DAILY_PLAYED_KEY = 'solitaire_daily_played';
const API_URL = '/api/leaderboard';

export interface LeaderboardEntry {
	name: string;
	score: number;
	moves: number;
	timeSeconds: number;
	date: string;   // UTC YYYY-MM-DD
	mode: 'daily' | 'random';
	seed: string;
}

export function seedLabel(entry: Pick<LeaderboardEntry, 'mode' | 'date' | 'seed'>): string {
	if (entry.mode === 'daily') return `Quotidien · ${entry.date}`;
	return `Aléatoire · graine ${entry.seed}`;
}

function loadLocal(): LeaderboardEntry[] {
	if (typeof window === 'undefined') return [];
	try { return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]'); }
	catch { return []; }
}

async function fetchFromAPI(): Promise<LeaderboardEntry[]> {
	try {
		const res = await fetch(API_URL, { cache: 'no-store' });
		if (!res.ok) return [];
		return await res.json();
	} catch { return []; }
}

let _entries = $state<LeaderboardEntry[]>(loadLocal());
let _loading = $state(false);

// Load from API on startup
if (typeof window !== 'undefined') {
	_loading = true;
	fetchFromAPI().then((remote) => {
		if (remote.length > 0) _entries = remote;
		_loading = false;
	}).catch(() => { _loading = false; });
}

export function hasPlayedDailyToday(): boolean {
	if (typeof window === 'undefined') return false;
	try {
		const stored = localStorage.getItem(DAILY_PLAYED_KEY);
		if (!stored) return false;
		const data = JSON.parse(stored);
		return data.date === todayDate();
	} catch { return false; }
}

function markDailyPlayed(): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(DAILY_PLAYED_KEY, JSON.stringify({ date: todayDate() }));
	} catch {}
}

export const leaderboard = {
	get entries() { return _entries; },
	get loading() { return _loading; },

	get daily(): LeaderboardEntry[] {
		const today = todayDate();
		return _entries
			.filter((e) => e.mode === 'daily' && e.date === today)
			.sort((a, b) => b.score - a.score)
			.slice(0, 10);
	},

	get allTime(): LeaderboardEntry[] {
		return [..._entries].sort((a, b) => b.score - a.score).slice(0, 10);
	},

	get randomBest(): LeaderboardEntry | null {
		const r = _entries.filter((e) => e.mode === 'random').sort((a, b) => b.score - a.score);
		return r[0] ?? null;
	},

	async submit(entry: LeaderboardEntry): Promise<void> {
		// Optimistic local update so the UI reflects the score immediately
		_entries = [entry, ..._entries];

		// Mark daily as played today so user can't replay it
		if (entry.mode === 'daily') markDailyPlayed();

		try {
			const res = await fetch(API_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(entry),
			});
			if (res.ok) {
				// Refresh from API to get the full shared leaderboard
				const remote = await fetchFromAPI();
				if (remote.length > 0) _entries = remote;
				return;
			}
		} catch { /* fall through to localStorage */ }

		// Fallback: persist locally if API unreachable
		if (typeof window !== 'undefined') {
			localStorage.setItem(LOCAL_KEY, JSON.stringify(_entries));
		}
	},

	/** Re-fetch from API (e.g. when leaderboard modal opens) */
	async refresh(): Promise<void> {
		const remote = await fetchFromAPI();
		if (remote.length > 0) _entries = remote;
	},
};

export function todayDate(): string {
	const d = new Date();
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function fmtTime(s: number): string {
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const KEY = 'solitaire_lb_v1';

export interface LeaderboardEntry {
	name: string;
	score: number;
	moves: number;
	timeSeconds: number;
	date: string;   // UTC YYYY-MM-DD
	mode: 'daily' | 'random';
	seed: string;
}

function load(): LeaderboardEntry[] {
	if (typeof window === 'undefined') return [];
	try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); }
	catch { return []; }
}

let _entries = $state<LeaderboardEntry[]>(load());

export const leaderboard = {
	get entries() { return _entries; },

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

	submit(entry: LeaderboardEntry) {
		_entries = [entry, ..._entries];
		if (typeof window !== 'undefined') {
			localStorage.setItem(KEY, JSON.stringify(_entries));
		}
	}
};

export function todayDate(): string {
	const d = new Date();
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function fmtTime(s: number): string {
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

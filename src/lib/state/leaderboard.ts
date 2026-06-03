import type { GameMode } from '@/lib/game/types';
import type { PlayerProfile } from './player';

export interface LeaderboardEntry {
	playerId: string;
	name: string;
	score: number;
	moves: number;
	timeSeconds: number;
	date: string;
	mode: GameMode;
	seed: string;
	restarts: number;
	streak: number;
}

export interface DailyStatus {
	date: string;
	started: boolean;
	completed: boolean;
	restarts: number;
	streak: number;
}

interface LocalAttempt {
	seed: string;
	started: boolean;
	completed: boolean;
	restarts: number;
}

const LOCAL_ENTRIES_KEY = 'klondike-lb';
const LOCAL_ATTEMPTS_KEY = 'klondike-da';

export function seedLabel(entry: Pick<LeaderboardEntry, 'mode' | 'date' | 'seed'>): string {
	if (entry.mode === 'daily') return `Daily · ${entry.date}`;
	return `Random · seed ${entry.seed}`;
}

export function todayDate(): string {
	const d = new Date();
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function fmtTime(s: number): string {
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
	try {
		const res = await fetch('/api/leaderboard', { cache: 'no-store' });
		if (!res.ok) return loadLocalEntries();
		const rows = (await res.json()) as LeaderboardEntry[];
		if (Array.isArray(rows)) {
			saveLocalEntries(rows);
			return rows.map(normalizeEntry);
		}
	} catch {}
	return loadLocalEntries();
}

export async function submitLeaderboard(entry: LeaderboardEntry): Promise<LeaderboardEntry[]> {
	const normalized = normalizeEntry(entry);
	const local = [normalized, ...loadLocalEntries()];
	saveLocalEntries(local);
	if (normalized.mode === 'daily') markLocalDailyCompleted(normalized.playerId, normalized.date, normalized.restarts);

	try {
		const res = await fetch('/api/leaderboard', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(normalized)
		});
		if (res.ok) return fetchLeaderboard();
	} catch {}
	return local;
}

export async function fetchDailyStatus(player: PlayerProfile, date = todayDate(), seed = ''): Promise<DailyStatus> {
	const local = getLocalDailyStatus(player.id, date);
	try {
		const qs = new URLSearchParams({ playerId: player.id, name: player.name, date, seed });
		const res = await fetch(`/api/daily-status?${qs}`, { cache: 'no-store' });
		if (!res.ok) return local;
		const remote = normalizeStatus((await res.json()) as Partial<DailyStatus>, date);
		return {
			date,
			started: remote.started || local.started,
			completed: remote.completed || local.completed,
			restarts: Math.max(remote.restarts, local.restarts),
			streak: Math.max(remote.streak, local.streak)
		};
	} catch {
		return local;
	}
}

export async function beginDailyAttempt(player: PlayerProfile, seed: string, date = todayDate()): Promise<DailyStatus> {
	const attempts = loadAttempts();
	const key = attemptKey(player.id, date);
	const current = attempts[key] ?? { seed, started: false, completed: false, restarts: 0 };

	if (current.completed) return getLocalDailyStatus(player.id, date);

	let shouldNotifyRestart = false;
	if (current.started) {
		current.restarts += 1;
		shouldNotifyRestart = true;
	} else {
		current.started = true;
	}
	current.seed = seed;
	attempts[key] = current;
	saveAttempts(attempts);

	if (shouldNotifyRestart) {
		try {
			const res = await fetch('/api/daily-restart', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ playerId: player.id, name: player.name, date, seed })
			});
			if (res.ok) {
				const remote = normalizeStatus((await res.json()) as Partial<DailyStatus>, date);
				current.restarts = Math.max(current.restarts, remote.restarts);
				saveAttempts({ ...attempts, [key]: current });
			}
		} catch {}
	}

	return getLocalDailyStatus(player.id, date);
}

export function markLocalDailyCompleted(playerId: string, date = todayDate(), restarts = 0): DailyStatus {
	const attempts = loadAttempts();
	const key = attemptKey(playerId, date);
	const current = attempts[key] ?? { seed: '', started: true, completed: false, restarts };
	current.started = true;
	current.completed = true;
	current.restarts = Math.max(current.restarts, restarts);
	attempts[key] = current;
	saveAttempts(attempts);
	return getLocalDailyStatus(playerId, date);
}

export function getLocalDailyStatus(playerId: string, date = todayDate()): DailyStatus {
	const attempts = loadAttempts();
	const attempt = attempts[attemptKey(playerId, date)];
	return {
		date,
		started: !!attempt?.started,
		completed: !!attempt?.completed,
		restarts: attempt?.restarts ?? 0,
		streak: computeLocalStreak(playerId, date, attempts)
	};
}

export function dailyRows(entries: LeaderboardEntry[], date = todayDate()): LeaderboardEntry[] {
	return entries
		.filter((entry) => entry.mode === 'daily' && entry.date === date)
		.sort((a, b) => b.score - a.score || a.timeSeconds - b.timeSeconds)
		.slice(0, 10);
}

export function allTimeRows(entries: LeaderboardEntry[]): LeaderboardEntry[] {
	return [...entries].sort((a, b) => b.score - a.score || a.timeSeconds - b.timeSeconds).slice(0, 10);
}

export function randomBest(entries: LeaderboardEntry[]): LeaderboardEntry | null {
	return entries.filter((entry) => entry.mode === 'random').sort((a, b) => b.score - a.score)[0] ?? null;
}

function loadLocalEntries(): LeaderboardEntry[] {
	if (typeof window === 'undefined') return [];
	try {
		const rows = JSON.parse(localStorage.getItem(LOCAL_ENTRIES_KEY) ?? '[]') as LeaderboardEntry[];
		return Array.isArray(rows) ? rows.map(normalizeEntry) : [];
	} catch {
		return [];
	}
}

function saveLocalEntries(entries: LeaderboardEntry[]): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(LOCAL_ENTRIES_KEY, JSON.stringify(entries.slice(0, 200)));
	} catch {}
}

function loadAttempts(): Record<string, LocalAttempt> {
	if (typeof window === 'undefined') return {};
	try {
		const rows = JSON.parse(localStorage.getItem(LOCAL_ATTEMPTS_KEY) ?? '{}') as Record<string, LocalAttempt>;
		return rows && typeof rows === 'object' ? rows : {};
	} catch {
		return {};
	}
}

function saveAttempts(attempts: Record<string, LocalAttempt>): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(LOCAL_ATTEMPTS_KEY, JSON.stringify(attempts));
	} catch {}
}

function computeLocalStreak(playerId: string, date: string, attempts: Record<string, LocalAttempt>): number {
	let cursor = attempts[attemptKey(playerId, date)]?.completed ? date : addDays(date, -1);
	if (!attempts[attemptKey(playerId, cursor)]?.completed) return 0;

	let streak = 0;
	while (attempts[attemptKey(playerId, cursor)]?.completed) {
		streak += 1;
		cursor = addDays(cursor, -1);
	}
	return streak;
}

function addDays(date: string, days: number): string {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function attemptKey(playerId: string, date: string): string {
	return `${playerId}:${date}`;
}

function normalizeEntry(entry: Partial<LeaderboardEntry>): LeaderboardEntry {
	return {
		playerId: String(entry.playerId ?? ''),
		name: String(entry.name ?? 'Anonymous Ace').slice(0, 20),
		score: Number(entry.score ?? 0),
		moves: Number(entry.moves ?? 0),
		timeSeconds: Number(entry.timeSeconds ?? 0),
		date: String(entry.date ?? todayDate()),
		mode: entry.mode === 'daily' ? 'daily' : 'random',
		seed: String(entry.seed ?? ''),
		restarts: Number(entry.restarts ?? 0),
		streak: Number(entry.streak ?? 0)
	};
}

function normalizeStatus(status: Partial<DailyStatus>, date: string): DailyStatus {
	return {
		date,
		started: !!status.started,
		completed: !!status.completed,
		restarts: Number(status.restarts ?? 0),
		streak: Number(status.streak ?? 0)
	};
}

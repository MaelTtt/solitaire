import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { Rank, Suit } from '@/lib/game/types';
import type { PlayerProfile } from './player';

export type DuelPhase = 'idle' | 'lobby' | 'countdown' | 'playing' | 'result';

export interface DuelRoomPlayer {
	id: string;
	name: string;
	avatar: string;
	ready: boolean;
	connected: boolean;
	trophies?: number;
}

export interface DuelRoomState {
	code: string;
	status: 'lobby' | 'countdown' | 'playing' | 'finished';
	hostId: string;
	drawMode: 1 | 3;
	difficulty?: string;
	difficultyPref?: 'any' | 'facile' | 'moyen' | 'difficile';
	players: DuelRoomPlayer[];
}

export interface DuelFoundationTop {
	suit: Suit;
	rank: Rank;
}

export interface DuelOpponent {
	id: string;
	name: string;
	avatar: string;
	foundations: DuelFoundationTop[];
	count: number;
	score: number;
	finished: boolean;
	finishTimeSeconds: number | null;
}

export interface DuelStanding {
	playerId: string;
	name: string;
	placement: number | null;
	score: number;
	timeSeconds: number | null;
	finished: boolean;
	trophies?: number | null;
}

export interface DuelTrophyDelta {
	playerId: string;
	trophies: number;
	delta: number;
}

export interface DuelResult {
	draw: boolean;
	cancelled: boolean;
	cancelReason?: string;
	standings: DuelStanding[];
	deltas: DuelTrophyDelta[];
	roomCode?: string;
}

export interface DuelStartInfo {
	seed: string;
	drawMode: 1 | 3;
	startedAt: number;
	difficulty?: string;
}

export interface TrophyProfile {
	playerId: string;
	name: string;
	trophies: number;
	bestTrophies: number;
	duelsPlayed: number;
	duelWins: number;
	league: string;
}

export interface DuelHistoryRow {
	roomCode: string;
	seed: string;
	placement: number | null;
	score: number;
	timeSeconds: number;
	finished: boolean;
	trophyDelta: number;
	createdAt: string;
}

const ERROR_LABELS: Record<string, string> = {
	ROOM_NOT_FOUND: 'Salle introuvable. Vérifie le code.',
	ROOM_FULL: 'Cette salle est complète (8 joueurs max).',
	ALREADY_IN_ROOM: 'Tu es déjà dans une salle.',
	GAME_IN_PROGRESS: 'La partie a déjà commencé.',
	NOT_HOST: 'Seul l\'hôte peut lancer la partie.',
	NEED_TWO_PLAYERS: 'Il faut au moins 2 joueurs connectés.',
	NOT_ALL_READY: 'Tout le monde doit être prêt.',
	SEED_UNAVAILABLE: 'Impossible de préparer une distribution certifiée. Réessaie.',
	FINISH_TOO_FAST: 'Victoire refusée par le serveur (trop rapide).',
	INVALID_MESSAGE: 'Message invalide.'
};

interface PendingAction {
	send: () => void;
}

export function useDuel(player: PlayerProfile) {
	const [phase, setPhase] = useState<DuelPhase>('idle');
	const [room, setRoom] = useState<DuelRoomState | null>(null);
	const [opponents, setOpponents] = useState<DuelOpponent[]>([]);
	const [countdownEndsAt, setCountdownEndsAt] = useState(0);
	const [startInfo, setStartInfo] = useState<DuelStartInfo | null>(null);
	const [result, setResult] = useState<DuelResult | null>(null);
	const [error, setError] = useState('');
	const [connected, setConnected] = useState(false);

	const wsRef = useRef<WebSocket | null>(null);
	const roomCodeRef = useRef<string | null>(null);
	const playerRef = useRef(player);
	const pendingRef = useRef<PendingAction | null>(null);
	const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const reconnectAttempts = useRef(0);
	const lastProgressSent = useRef(0);

	playerRef.current = player;

	const clearReconnect = () => {
		if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
		reconnectTimer.current = null;
	};

	const send = useCallback((message: unknown) => {
		const ws = wsRef.current;
		if (ws && ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(message));
			return true;
		}
		return false;
	}, []);

	const connect = useCallback(() => {
		if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) return;

		const proto = typeof location !== 'undefined' && location.protocol === 'https:' ? 'wss' : 'ws';
		const ws = new WebSocket(`${proto}://${location.host}/ws`);
		wsRef.current = ws;

		ws.onopen = () => {
			reconnectAttempts.current = 0;
			setConnected(true);
			if (roomCodeRef.current) {
				// Reconnexion : rejoint la salle et récupère l'état complet
				send({ t: 'join_room', code: roomCodeRef.current, playerId: playerRef.current.id, name: playerRef.current.name, avatar: playerRef.current.avatar });
			} else if (pendingRef.current) {
				const action = pendingRef.current;
				pendingRef.current = null;
				action.send();
			}
		};
		ws.onmessage = (event) => {
			let message: Record<string, unknown>;
			try {
				message = JSON.parse(String(event.data)) as Record<string, unknown>;
			} catch {
				return;
			}
			handleServerMessage(message);
		};
		ws.onclose = () => {
			setConnected(false);
			wsRef.current = null;
			if (roomCodeRef.current) {
				clearReconnect();
				reconnectTimer.current = setTimeout(connect, Math.min(5000, 1000 * Math.pow(2, reconnectAttempts.current++)));
			}
		};
		ws.onerror = () => {};
	}, [send]);

	const handleServerMessage = useCallback((message: Record<string, unknown>) => {
		const type = message.t;
		if (type === 'room_state') {
			const state = message.room as DuelRoomState;
			setRoom(state);
			setError('');
			if (state.status === 'lobby') setPhase('lobby');
			else if (state.status === 'countdown') setPhase('countdown');
		} else if (type === 'countdown') {
			setCountdownEndsAt(Number(message.endsAt ?? 0));
			setPhase('countdown');
		} else if (type === 'game_start') {
			setStartInfo({
				seed: String(message.seed ?? ''),
				drawMode: (message.drawMode === 3 ? 3 : 1),
				startedAt: Number(message.startedAt ?? Date.now()),
				difficulty: message.difficulty ? String(message.difficulty) : undefined
			});
			setPhase('playing');
			setOpponents([]);
		} else if (type === 'opponents') {
			setOpponents((message.players as DuelOpponent[]) ?? []);
		} else if (type === 'game_over') {
			setResult({
				draw: message.draw === true,
				cancelled: message.cancelled === true,
				cancelReason: message.cancelReason ? String(message.cancelReason) : undefined,
				standings: (message.standings as DuelStanding[]) ?? [],
				deltas: (message.deltas as DuelTrophyDelta[]) ?? [],
				roomCode: message.roomCode ? String(message.roomCode) : undefined
			});
			setPhase('result');
			roomCodeRef.current = null;
			pendingRef.current = null;
		} else if (type === 'error') {
			const code = String(message.code ?? '');
			// En cas d'erreur fatale de connexion à la salle, on repart de zéro
			if (['ROOM_NOT_FOUND', 'ROOM_FULL', 'GAME_IN_PROGRESS', 'ALREADY_IN_ROOM'].includes(code)) {
				roomCodeRef.current = null;
				setRoom(null);
				setPhase('idle');
			}
			setError(ERROR_LABELS[code] ?? 'Erreur inconnue.');
		}
	}, []);

	useEffect(() => () => {
		clearReconnect();
		const ws = wsRef.current;
		if (ws) {
			ws.onclose = null;
			ws.close();
		}
	}, []);

	const createRoom = useCallback(() => {
		setError('');
		setResult(null);
		setStartInfo(null);
		setOpponents([]);
		roomCodeRef.current = null;
		const doCreate = () => send({ t: 'create_room', playerId: playerRef.current.id, name: playerRef.current.name, avatar: playerRef.current.avatar });
		if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
			doCreate();
		} else {
			pendingRef.current = { send: doCreate };
			connect();
		}
	}, [connect, send]);

	const joinRoom = useCallback((code: string) => {
		const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
		if (!clean) return;
		setError('');
		setResult(null);
		setStartInfo(null);
		setOpponents([]);
		roomCodeRef.current = clean;
		const doJoin = () => send({ t: 'join_room', code: clean, playerId: playerRef.current.id, name: playerRef.current.name, avatar: playerRef.current.avatar });
		if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
			doJoin();
		} else {
			pendingRef.current = { send: doJoin };
			connect();
		}
	}, [connect, send]);

	const setReady = useCallback((ready: boolean) => {
		send({ t: 'set_ready', ready });
	}, [send]);

	const setDifficulty = useCallback((pref: 'any' | 'facile' | 'moyen' | 'difficile') => {
		send({ t: 'set_difficulty', pref });
	}, [send]);

	/** Revanche : rejoint (ou crée) le lobby d'attente de la salle qui vient de finir. */
	const rematch = useCallback((oldCode: string) => {
		const clean = oldCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
		if (!clean) return;
		setError('');
		setResult(null);
		setStartInfo(null);
		setOpponents([]);
		roomCodeRef.current = null;
		const doRematch = () => send({ t: 'rematch', oldCode: clean, playerId: playerRef.current.id, name: playerRef.current.name, avatar: playerRef.current.avatar });
		if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
			doRematch();
		} else {
			pendingRef.current = { send: doRematch };
			connect();
		}
	}, [connect, send]);

	const start = useCallback(() => {
		send({ t: 'start_game' });
	}, [send]);

	const leave = useCallback(() => {
		roomCodeRef.current = null;
		pendingRef.current = null;
		clearReconnect();
		send({ t: 'leave_room' });
		setRoom(null);
		setOpponents([]);
		setCountdownEndsAt(0);
		setStartInfo(null);
		setPhase('idle');
	}, [send]);

	const sendProgress = useCallback((foundations: DuelFoundationTop[], count: number, score: number) => {
		const now = Date.now();
		if (now - lastProgressSent.current < 2000) return;
		lastProgressSent.current = now;
		send({ t: 'progress', foundations, count, score });
	}, [send]);

	const sendFinished = useCallback((score: number, _moves: number) => {
		send({ t: 'finished', score, moves: _moves });
	}, [send]);

	return {
		phase, room, opponents, countdownEndsAt, startInfo, result, error, connected,
		isHost: !!room && room.hostId === player.id,
		ensureConnected: connect,
		createRoom, joinRoom, rematch, setReady, setDifficulty, start, leave, sendProgress, sendFinished
	};
}

export async function fetchTrophies(playerId: string): Promise<TrophyProfile | null> {
	try {
		const res = await fetch(`/api/player-trophies?playerId=${encodeURIComponent(playerId)}`, { cache: 'no-store' });
		if (!res.ok) return null;
		return (await res.json()) as TrophyProfile;
	} catch {
		return null;
	}
}

export async function fetchDuelHistory(playerId: string, limit = 10): Promise<DuelHistoryRow[]> {
	try {
		const res = await fetch(`/api/duel-history?playerId=${encodeURIComponent(playerId)}&limit=${limit}`, { cache: 'no-store' });
		if (!res.ok) return [];
		const rows = (await res.json()) as DuelHistoryRow[];
		return Array.isArray(rows) ? rows : [];
	} catch {
		return [];
	}
}

export interface TrophiesLeaderboardRow {
	playerId: string;
	name: string;
	trophies: number;
	bestTrophies: number;
	duelsPlayed: number;
	duelWins: number;
	league: string;
}

export async function fetchTrophiesLeaderboard(): Promise<TrophiesLeaderboardRow[]> {
	try {
		const res = await fetch('/api/trophies-all', { cache: 'no-store' });
		if (!res.ok) return [];
		const rows = (await res.json()) as TrophiesLeaderboardRow[];
		return Array.isArray(rows) ? rows : [];
	} catch {
		return [];
	}
}

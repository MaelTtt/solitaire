import { WebSocketServer, type WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { randomBytes } from 'node:crypto';
import type { Rank, Suit } from '../src/lib/game/types';
import { difficultyLabel, findDuelSeed } from '../src/lib/game/solver';
import { getSharedDb, getTrophyProfile } from './trophies';

import { applyDuelResults, DUEL_LOSS, duelDeltas, type DuelResultRow } from './trophies';

const MAX_PLAYERS = 8;
const MAX_ROOMS = 200;
const COUNTDOWN_MS = 5000;
const GAME_MAX_MS = 10 * 60 * 1000;
// Surchargeable pour les tests (DUEL_MIN_FINISH_SECONDS=2)
const MIN_FINISH_SECONDS = Number(process.env.DUEL_MIN_FINISH_SECONDS ?? 30);
const PROGRESS_THROTTLE_MS = 2000;
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

type RoomStatus = 'lobby' | 'countdown' | 'playing' | 'finished';
type DifficultyPref = 'any' | 'facile' | 'moyen' | 'difficile';

interface FoundationTop {
	suit: Suit;
	rank: Rank;
}

interface RoomPlayer {
	playerId: string;
	name: string;
	avatar: string;
	ready: boolean;
	connected: boolean;
	ws: WebSocket | null;
	progress: number; // fondations / 52
	foundations: FoundationTop[];
	count: number;
	score: number;
	finished: boolean;
	finishTimeSeconds: number | null;
	placement: number | null;
	lastProgressAt: number;
}

interface Room {
	code: string;
	hostId: string;
	seed: string;
	drawMode: 1 | 3;
	difficulty: string;
	difficultyPref: DifficultyPref;
	status: RoomStatus;
	countdownEndsAt: number | null;
	startedAt: number | null;
	endsAt: number | null;
	players: Map<string, RoomPlayer>;
}

interface ClientEntry {
	ws: WebSocket;
	playerId: string;
	roomCode: string | null;
}

type ClientMessage =
	| { t: 'create_room'; playerId?: unknown; name?: unknown; avatar?: unknown }
	| { t: 'join_room'; code?: unknown; playerId?: unknown; name?: unknown; avatar?: unknown }
	| { t: 'rematch'; oldCode?: unknown; playerId?: unknown; name?: unknown; avatar?: unknown }
	| { t: 'set_difficulty'; pref?: unknown }
	| { t: 'leave_room' }
	| { t: 'set_ready'; ready?: unknown }
	| { t: 'start_game' }
	| { t: 'progress'; foundations?: unknown; count?: unknown; score?: unknown }
	| { t: 'finished'; score?: unknown; moves?: unknown };

const rooms = new Map<string, Room>();
/** Codes de salles terminées → nouvelle salle lobby créée via Revanche. */
const rematchRooms = new Map<string, Room>();
const clients = new WeakMap<WebSocket, ClientEntry>();

export function setupRooms(server: import('node:http').Server): void {
	const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });

	server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
		const { pathname } = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
		if (pathname !== '/ws') return; // laisse les autres listeners (Vite HMR…) gérer
		wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
	});

	wss.on('connection', (ws) => {
		clients.set(ws, { ws, playerId: '', roomCode: null });
		ws.on('message', (raw) => {
			let message: ClientMessage;
			try {
				message = JSON.parse(String(raw)) as ClientMessage;
			} catch {
				return;
			}
			if (!message || typeof message !== 'object' || typeof message.t !== 'string') return;
			try {
				handleMessage(ws, message);
			} catch (error) {
				console.error('[rooms] message error:', message.t, error);
			}
		});
		ws.on('close', () => handleDisconnect(ws));
		ws.on('error', () => {});
	});

	setInterval(tickRooms, 1000).unref();
}

function handleMessage(ws: WebSocket, message: ClientMessage): void {
	const client = clients.get(ws);
	if (!client) return;

	switch (message.t) {
		case 'create_room': {
			const playerId = sanitizeId(message.playerId);
			if (!playerId) return sendError(ws, 'INVALID_MESSAGE');
			if (client.roomCode) return sendError(ws, 'ALREADY_IN_ROOM');
			const room = createEmptyRoom(playerId, sanitizeName(message.name), sanitizeAvatar(message.avatar));
			client.playerId = playerId;
			client.roomCode = room.code;
			bindSocket(room, playerId, ws);
			broadcastRoomState(room);
			return;
		}
		case 'rematch': {
			// Revanche : rejoint (ou crée) le lobby d'attente de l'ancienne salle
			const playerId = sanitizeId(message.playerId);
			const oldCode = sanitizeRoomCode(message.oldCode);
			if (!playerId || !oldCode) return sendError(ws, 'INVALID_MESSAGE');
			if (client.roomCode) return sendError(ws, 'ALREADY_IN_ROOM');
			let room = rematchRooms.get(oldCode);
			if (room && (room.status !== 'lobby' || !rooms.has(room.code))) room = undefined;
			if (!room) {
				if (rooms.size >= MAX_ROOMS) return sendError(ws, 'ROOM_LIMIT');
				room = createEmptyRoom(playerId, sanitizeName(message.name), sanitizeAvatar(message.avatar));
				rematchRooms.set(oldCode, room);
			}
			const existing = room.players.get(playerId);
			if (existing) {
				existing.ws = ws;
				existing.connected = true;
			} else {
				if (room.players.size >= MAX_PLAYERS) return sendError(ws, 'ROOM_FULL');
				room.players.set(playerId, newPlayer(playerId, sanitizeName(message.name), sanitizeAvatar(message.avatar), ws));
			}
			client.playerId = playerId;
			client.roomCode = room.code;
			broadcastRoomState(room);
			return;
		}
		case 'set_difficulty': {
			const room = currentRoom(client);
			const player = currentPlayer(client);
			if (!room || !player) return;
			if (room.status !== 'lobby') return;
			if (room.hostId !== player.playerId) return sendError(ws, 'NOT_HOST');
			const pref = String(message.pref ?? 'any');
			room.difficultyPref = (['any', 'facile', 'moyen', 'difficile'].includes(pref) ? pref : 'any') as DifficultyPref;
			broadcastRoomState(room);
			return;
		}
		case 'join_room': {
			const playerId = sanitizeId(message.playerId);
			const code = sanitizeRoomCode(message.code);
			if (!playerId || !code) return sendError(ws, 'INVALID_MESSAGE');
			const room = rooms.get(code);
			if (!room) return sendError(ws, 'ROOM_NOT_FOUND');
			if (client.roomCode) return sendError(ws, 'ALREADY_IN_ROOM');

			const existing = room.players.get(playerId);
			if (existing) {
				// Reconnexion
				existing.ws = ws;
				existing.connected = true;
				existing.name = sanitizeName(message.name) || existing.name;
				existing.avatar = sanitizeAvatar(message.avatar) || existing.avatar;
			} else {
				if (room.status !== 'lobby') return sendError(ws, 'GAME_IN_PROGRESS');
				if (room.players.size >= MAX_PLAYERS) return sendError(ws, 'ROOM_FULL');
				room.players.set(playerId, newPlayer(playerId, sanitizeName(message.name), sanitizeAvatar(message.avatar), ws));
			}
			client.playerId = playerId;
			client.roomCode = room.code;
			broadcastRoomState(room);
			if (room.status === 'playing' || room.status === 'countdown') {
				sendTo(ws, { t: 'countdown', endsAt: room.countdownEndsAt ?? 0 });
				if (room.startedAt) sendTo(ws, { t: 'game_start', seed: room.seed, drawMode: room.drawMode, startedAt: room.startedAt });
				sendOpponents(room);
			}
			return;
		}
		case 'leave_room': {
			leaveRoom(client);
			return;
		}
		case 'set_ready': {
			const room = currentRoom(client);
			const player = currentPlayer(client);
			if (!room || !player) return;
			if (room.status !== 'lobby') return;
			player.ready = message.ready === true;
			broadcastRoomState(room);
			return;
		}
		case 'start_game': {
			const room = currentRoom(client);
			const player = currentPlayer(client);
			if (!room || !player) return;
			if (room.status !== 'lobby') return sendError(ws, 'GAME_IN_PROGRESS');
			if (room.hostId !== player.playerId) return sendError(ws, 'NOT_HOST');
			const connected = [...room.players.values()].filter((entry) => entry.connected);
			if (connected.length < 2) return sendError(ws, 'NEED_TWO_PLAYERS');
			if (!connected.every((entry) => entry.ready)) return sendError(ws, 'NOT_ALL_READY');
			// La distribution est choisie au lancement, selon la difficulté demandée
			const deal = pickRoomDeal(room);
			if (!deal) return sendError(ws, 'SEED_UNAVAILABLE');
			room.seed = deal.seed;
			room.difficulty = difficultyLabel(deal.forgiveness);
			room.status = 'countdown';
			room.countdownEndsAt = Date.now() + COUNTDOWN_MS;
			broadcast(room, { t: 'countdown', endsAt: room.countdownEndsAt });
			return;
		}
		case 'progress': {
			const room = currentRoom(client);
			const player = currentPlayer(client);
			if (!room || !player || room.status !== 'playing') return;
			const now = Date.now();
			if (player.lastProgressAt && now - player.lastProgressAt < PROGRESS_THROTTLE_MS) return;
			const count = clampInt(message.count, 0, 52);
			if (count < player.count) return; // progression monotone
			player.lastProgressAt = now;
			player.count = count;
			player.score = clampInt(message.score, 0, 100000);
			player.foundations = sanitizeFoundations(message.foundations);
			player.progress = count / 52;
			sendOpponents(room);
			return;
		}
		case 'finished': {
			const room = currentRoom(client);
			const player = currentPlayer(client);
			if (!room || !player || room.status !== 'playing') return;
			if (player.finished) return;
			const now = Date.now();
			const elapsedSeconds = room.startedAt ? Math.floor((now - room.startedAt) / 1000) : 0;
			if (elapsedSeconds < MIN_FINISH_SECONDS) return sendError(ws, 'FINISH_TOO_FAST');
			player.finished = true;
			player.finishTimeSeconds = elapsedSeconds; // temps officiel serveur
			player.score = clampInt(message.score, 0, 100000);
			player.placement = [...room.players.values()].filter((entry) => entry.finished).length;
			player.count = 52;
			player.progress = 1;
			sendOpponents(room);
			// Sprint pur : à 2 joueurs la partie est décidée dès le premier qui finit ;
			// à 3+ on continue pour la 2e place, sauf si tout le monde a fini.
			const connected = [...room.players.values()].filter((entry) => entry.connected);
			const decided = connected.every((entry) => entry.finished)
				|| (room.players.size === 2 && connected.length === 2);
			if (decided) {
				finalizeRoom(room, false);
			}
			return;
		}
	}
}

function handleDisconnect(ws: WebSocket): void {
	const client = clients.get(ws);
	if (!client) return;
	if (client.roomCode) {
		const room = rooms.get(client.roomCode);
		const player = room?.players.get(client.playerId);
		if (room && player && player.ws === ws) {
			player.connected = false;
			player.ws = null;
			if (room.status === 'lobby' || room.status === 'countdown') {
				broadcastRoomState(room);
			} else if (room.status === 'playing') {
				const elapsedSeconds = room.startedAt ? (Date.now() - room.startedAt) / 1000 : 0;
				const someoneFinished = [...room.players.values()].some((entry) => entry.finished);
				if (elapsedSeconds < MIN_FINISH_SECONDS && !someoneFinished) {
					// Partie ignorée : aucun résultat, aucun trophée
					cancelRoom(room, 'PLAYER_LEFT_EARLY');
				} else {
					const stillConnected = [...room.players.values()].filter((entry) => entry.connected);
					if (stillConnected.length < 2) {
						awardByForfeit(room);
					} else {
						broadcastRoomState(room);
						sendOpponents(room);
					}
				}
			}
		}
	}
	clients.delete(ws);
}

function leaveRoom(client: ClientEntry): void {
	const room = client.roomCode ? rooms.get(client.roomCode) : undefined;
	if (!room) {
		client.roomCode = null;
		return;
	}
	const player = room.players.get(client.playerId);
	if (player && player.ws === client.ws) player.connected = false;

	if (room.status === 'lobby' || room.status === 'countdown') {
		room.players.delete(client.playerId);
		if (room.hostId === client.playerId) {
			const next = [...room.players.values()].find((entry) => entry.connected);
			if (next) {
				room.hostId = next.playerId;
			} else {
				rooms.delete(room.code);
				client.roomCode = null;
				return;
			}
		}
		if (room.status === 'countdown') {
			room.status = 'lobby';
			room.countdownEndsAt = null;
			for (const entry of room.players.values()) entry.ready = false;
		}
		broadcastRoomState(room);
	} else if (room.status === 'playing') {
		handleDisconnect(client.ws);
	}
	client.roomCode = null;
}

function tickRooms(): void {
	const now = Date.now();
	for (const room of [...rooms.values()]) {
		if (room.status === 'countdown' && room.countdownEndsAt && now >= room.countdownEndsAt) {
			room.status = 'playing';
			room.startedAt = now;
			room.endsAt = now + GAME_MAX_MS;
			for (const player of room.players.values()) {
				player.progress = 0;
				player.count = 0;
				player.score = 0;
				player.foundations = [];
				player.finished = false;
				player.finishTimeSeconds = null;
				player.placement = null;
			}
			broadcast(room, { t: 'game_start', seed: room.seed, drawMode: room.drawMode, startedAt: room.startedAt, difficulty: room.difficulty });
			broadcastRoomState(room);
		} else if (room.status === 'playing' && room.endsAt && now >= room.endsAt) {
			finalizeRoom(room, true);
		}
	}
}

function awardByForfeit(room: Room): void {
	// Moins de 2 joueurs connectés en pleine partie (après 30 s) : victoire par forfait
	// pour les joueurs restés en place, défaite (-20) pour les partants.
	const elapsedSeconds = room.startedAt ? Math.floor((Date.now() - room.startedAt) / 1000) : 0;
	const finisherCount = [...room.players.values()].filter((player) => player.finished).length;
	for (const player of room.players.values()) {
		if (player.connected && !player.finished) {
			player.finished = true;
			player.finishTimeSeconds = elapsedSeconds;
			player.placement = finisherCount + 1;
		}
	}
	finalizeRoom(room, false);
}

function finalizeRoom(room: Room, timedOut: boolean): void {
	if (room.status === 'finished') return;
	room.status = 'finished';

	const players = [...room.players.values()];
	const finishers = players.filter((player) => player.finished).sort((a, b) => (a.finishTimeSeconds ?? 0) - (b.finishTimeSeconds ?? 0));
	const draw = finishers.length === 0;

	const standings = players
		.map((player) => ({
			playerId: player.playerId,
			name: player.name,
			placement: player.placement ?? null,
			score: player.score,
			timeSeconds: player.finishTimeSeconds,
			finished: player.finished
		}))
		.sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99) || b.score - a.score);

	const placements = players.map((player) => player.placement);
	const deltas = duelDeltas(placements, draw, players.length);

	const results: DuelResultRow[] = players.map((player, index) => ({
		playerId: player.playerId,
		name: player.name,
		placement: draw ? null : player.placement,
		score: player.score,
		timeSeconds: player.finishTimeSeconds ?? Math.floor((Date.now() - (room.startedAt ?? Date.now())) / 1000),
		finished: player.finished,
		trophyDelta: draw ? 0 : deltas[index] ?? DUEL_LOSS
	}));

	let trophies: Array<{ playerId: string; trophies: number; delta: number }> = [];
	if (players.length >= 2) {
		trophies = applyDuelResults(getSharedDb(), room.code, room.seed, results);
	}

	// Trophées après le duel, affichés à côté de chaque pseudo du classement final
	const trophiesAfter = new Map(trophies.map((entry) => [entry.playerId, entry.trophies]));
	for (const standing of standings) {
		(standing as { trophies?: number }).trophies = trophiesAfter.get(standing.playerId) ?? undefined;
	}

	broadcast(room, { t: 'game_over', draw, cancelled: false, standings, deltas: trophies, seed: room.seed, roomCode: room.code });
	rooms.delete(room.code);
	// Libère les clients : ils peuvent cliquer Revanche ou rejoindre une autre salle
	for (const player of room.players.values()) {
		if (!player.ws) continue;
		const client = clients.get(player.ws);
		if (client && client.roomCode === room.code) client.roomCode = null;
	}
}

function cancelRoom(room: Room, reason: string): void {
	if (room.status === 'finished') return;
	room.status = 'finished';
	broadcast(room, { t: 'game_over', draw: false, cancelled: true, cancelReason: reason, standings: [], deltas: [], seed: room.seed, roomCode: room.code });
	rooms.delete(room.code);
	for (const player of room.players.values()) {
		if (!player.ws) continue;
		const client = clients.get(player.ws);
		if (client && client.roomCode === room.code) client.roomCode = null;
	}
}

function createEmptyRoom(hostId: string, name: string, avatar: string): Room {
	// La seed est calculée au lancement (start_game) selon la difficulté choisie
	const code = generateRoomCode();
	const room: Room = {
		code,
		hostId,
		seed: '',
		drawMode: 1,
		difficulty: '',
		difficultyPref: 'any',
		status: 'lobby',
		countdownEndsAt: null,
		startedAt: null,
		endsAt: null,
		players: new Map()
	};
	room.players.set(hostId, newPlayer(hostId, name, avatar, null));
	room.players.get(hostId)!.ready = true;
	rooms.set(code, room);
	return room;
}

/** Choisit une distribution selon la difficulté demandée pour cette salle. */
function pickRoomDeal(room: Room) {
	const baseSeed = `${room.code}-${Date.now()}`;
	if (room.difficultyPref === 'difficile') {
		return findDuelSeed(baseSeed, 1, 16, { maxVisitedStates: 30000, rollouts: 36, target: 'difficile' });
	}
	if (room.difficultyPref === 'facile') {
		return findDuelSeed(baseSeed, 1, 16, { maxVisitedStates: 30000, rollouts: 36, target: 'facile' });
	}
	if (room.difficultyPref === 'moyen') {
		return findDuelSeed(baseSeed, 1, 16, { maxVisitedStates: 30000, rollouts: 36, target: 'moyen' });
	}
	return findDuelSeed(baseSeed, 1, 14, { maxVisitedStates: 30000, rollouts: 36, minWinRate: 0.12 });
}

function generateRoomCode(): string {
	for (let attempt = 0; attempt < 50; attempt++) {
		let code = '';
		for (let i = 0; i < 5; i++) {
			code += ROOM_CODE_CHARS[randomBytes(1)[0] % ROOM_CODE_CHARS.length];
		}
		if (!rooms.has(code)) return code;
	}
	return `R${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

function newPlayer(playerId: string, name: string, avatar: string, ws: WebSocket | null): RoomPlayer {
	return {
		playerId,
		name: name || 'Anonymous Ace',
		avatar: avatar || '♠',
		ready: false,
		connected: !!ws,
		ws,
		progress: 0,
		foundations: [],
		count: 0,
		score: 0,
		finished: false,
		finishTimeSeconds: null,
		placement: null,
		lastProgressAt: 0
	};
}

function bindSocket(room: Room, playerId: string, ws: WebSocket): void {
	const player = room.players.get(playerId);
	if (player) {
		player.ws = ws;
		player.connected = true;
	}
}

function currentRoom(client: ClientEntry): Room | null {
	return client.roomCode ? rooms.get(client.roomCode) ?? null : null;
}

function currentPlayer(client: ClientEntry): RoomPlayer | null {
	return currentRoom(client)?.players.get(client.playerId) ?? null;
}

function roomStatePayload(room: Room) {
	const db = getSharedDb();
	const trophiesFor = (playerId: string): number => getTrophyProfile(db, playerId)?.trophies ?? 0;
	return {
		t: 'room_state' as const,
		room: {
			code: room.code,
			status: room.status,
			hostId: room.hostId,
			drawMode: room.drawMode,
			difficulty: room.difficulty,
			difficultyPref: room.difficultyPref,
			players: [...room.players.values()].map((player) => ({
				id: player.playerId,
				name: player.name,
				avatar: player.avatar,
				ready: player.ready,
				connected: player.connected,
				trophies: trophiesFor(player.playerId)
			}))
		}
	};
}

function opponentsPayload(room: Room) {
	return {
		t: 'opponents' as const,
		players: [...room.players.values()]
			.filter((player) => player.connected)
			.map((player) => ({
				id: player.playerId,
				name: player.name,
				avatar: player.avatar,
				foundations: player.foundations,
				count: player.count,
				score: player.score,
				finished: player.finished,
				finishTimeSeconds: player.finishTimeSeconds
			}))
	};
}

function broadcastRoomState(room: Room): void {
	broadcast(room, roomStatePayload(room));
}

function sendOpponents(room: Room): void {
	broadcast(room, opponentsPayload(room));
}

function broadcast(room: Room, message: unknown): void {
	for (const player of room.players.values()) {
		if (player.ws && player.connected) sendTo(player.ws, message);
	}
}

function sendTo(ws: WebSocket, message: unknown): void {
	try {
		ws.send(JSON.stringify(message));
	} catch {}
}

function sendError(ws: WebSocket, code: string): void {
	sendTo(ws, { t: 'error', code });
}

function sanitizeId(value: unknown): string {
	return String(value ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
}

function sanitizeName(value: unknown): string {
	const clean = String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 20);
	return clean || '';
}

function sanitizeAvatar(value: unknown): string {
	return String(value ?? '').slice(0, 2);
}

function sanitizeRoomCode(value: unknown): string {
	return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

function sanitizeFoundations(value: unknown): FoundationTop[] {
	if (!Array.isArray(value)) return [];
	return value
		.slice(0, 4)
		.map((entry) => {
			const suit = String((entry as FoundationTop)?.suit ?? '') as Suit;
			const rank = Number((entry as FoundationTop)?.rank ?? 0);
			if (!['spades', 'hearts', 'diamonds', 'clubs'].includes(suit)) return null;
			if (!Number.isInteger(rank) || rank < 1 || rank > 13) return null;
			return { suit, rank: rank as Rank };
		})
		.filter((entry): entry is FoundationTop => entry !== null);
}

function clampInt(value: unknown, min: number, max: number): number {
	const num = Math.floor(Number(value ?? min));
	if (!Number.isFinite(num)) return min;
	return Math.max(min, Math.min(max, num));
}

// Nettoyage mémoire : salles sans aucun joueur connecté depuis plus d'un cycle,
// et entrées Revanche obsolètes (lobby parti, ou déjà lancé).
setInterval(() => {
	for (const [code, room] of rooms.entries()) {
		const connected = [...room.players.values()].filter((player) => player.connected);
		if (connected.length === 0) rooms.delete(code);
	}
	for (const [oldCode, room] of rematchRooms.entries()) {
		if (room.status !== 'lobby' || !rooms.has(room.code) || [...room.players.values()].every((player) => !player.connected)) {
			rematchRooms.delete(oldCode);
		}
	}
}, 60_000).unref();

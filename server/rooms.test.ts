import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createServer as createHttpServer, type Server } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';

// Environnement isolé : DATA_DIR temporaire + seuil de forfait court AVANT import des modules serveur
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'solitaire-rooms-'));
process.env.DUEL_MIN_FINISH_SECONDS = '2';

const { setupRooms } = await import('./rooms');

let httpServer: Server;
let baseUrl = '';
const sockets: WebSocket[] = [];

beforeAll(async () => {
	httpServer = createHttpServer();
	setupRooms(httpServer);
	await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
	const address = httpServer.address();
	const port = typeof address === 'object' && address ? address.port : 0;
	baseUrl = `ws://127.0.0.1:${port}/ws`;
});

afterAll(async () => {
	for (const ws of sockets) ws.close();
	await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

interface WaitOptions {
	timeoutMs?: number;
}

function connect(): WebSocket {
	const ws = new WebSocket(baseUrl);
	sockets.push(ws);
	return ws;
}

/** Attend un message d'un type donné (en consommant les autres). */
function waitFor(ws: WebSocket, type: string, options: WaitOptions = {}): Promise<Record<string, unknown>> {
	const timeoutMs = options.timeoutMs ?? 8000;
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			ws.off('message', onMessage);
			reject(new Error(`timeout waiting for "${type}"`));
		}, timeoutMs);
		const onMessage = (raw: WebSocket.RawData) => {
			const message = JSON.parse(String(raw)) as Record<string, unknown>;
			if (message.t !== type) return; // on ignore les autres messages
			clearTimeout(timer);
			ws.off('message', onMessage);
			resolve(message);
		};
		ws.on('message', onMessage);
	});
}

function send(ws: WebSocket, message: Record<string, unknown>): void {
	ws.send(JSON.stringify(message));
}

describe('rooms lifecycle', () => {
	test('create → join → ready → start → progress → finish → game_over', async () => {
		const host = connect();
		await new Promise((resolve) => host.once('open', resolve));
		send(host, { t: 'create_room', playerId: 'host-1', name: 'Host', avatar: '♠' });
		const state1 = await waitFor(host, 'room_state');
		const room = state1.room as { code: string; hostId: string };
		expect(room.code).toHaveLength(5);
		expect(room.hostId).toBe('host-1');

		const guest = connect();
		await new Promise((resolve) => guest.once('open', resolve));
		send(guest, { t: 'join_room', code: room.code, playerId: 'guest-1', name: 'Guest', avatar: '♥' });
		const state2 = await waitFor(guest, 'room_state');
		expect((state2.room as { players: unknown[] }).players).toHaveLength(2);

		// Salle inconnue → erreur
		const stranger = connect();
		await new Promise((resolve) => stranger.once('open', resolve));
		send(stranger, { t: 'join_room', code: 'ZZZZZ', playerId: 'stranger', name: 'X', avatar: '♦' });
		const err = await waitFor(stranger, 'error');
		expect(err.code).toBe('ROOM_NOT_FOUND');
		stranger.close();

		// Ready des deux côtés puis départ
		send(host, { t: 'set_ready', ready: true });
		send(guest, { t: 'set_ready', ready: true });
		send(host, { t: 'start_game' });
		const countdown = await waitFor(host, 'countdown');
		expect(Number(countdown.endsAt)).toBeGreaterThan(Date.now() - 1000);

		const startHost = await waitFor(host, 'game_start');
		const startGuest = await waitFor(guest, 'game_start');
		expect(String(startHost.seed)).toContain('verified-v3');
		expect(startHost.seed).toBe(startGuest.seed);
		expect(Number(startHost.startedAt)).toBeGreaterThan(0);
		expect((startHost as unknown as { drawMode: number }).drawMode).toBe(1);

		// Progression relayée (avec carte de fondation)
		send(guest, { t: 'progress', foundations: [{ suit: 'spades', rank: 1 }], count: 1, score: 10 });
		const opp = await waitFor(host, 'opponents');
		const players = opp.players as Array<{ id: string; count: number; foundations: Array<{ suit: string; rank: number }> }>;
		const guestEntry = players.find((entry) => entry.id === 'guest-1');
		expect(guestEntry?.count).toBe(1);
		expect(guestEntry?.foundations[0]).toEqual({ suit: 'spades', rank: 1 });

		// L'hôte gagne
		send(host, { t: 'finished', score: 420, moves: 90 });
		const over = await waitFor(guest, 'game_over', { timeoutMs: 12000 });
		expect(over.draw).toBe(false);
		const standings = over.standings as Array<{ playerId: string; placement: number | null; finished: boolean }>;
		expect(standings[0].playerId).toBe('host-1');
		expect(standings[0].placement).toBe(1);
		const deltas = over.deltas as Array<{ playerId: string; delta: number }>;
		expect(deltas.find((d) => d.playerId === 'host-1')?.delta).toBe(40);
		// Perdant avec plancher Bois : jamais négatif
		expect(deltas.find((d) => d.playerId === 'guest-1')?.delta).toBeLessThanOrEqual(0);
	}, 30000);

	test('forfeit after 30s awards the remaining player', async () => {
		const host = connect();
		await new Promise((resolve) => host.once('open', resolve));
		send(host, { t: 'create_room', playerId: 'host-2', name: 'Host2', avatar: '♠' });
		const state1 = await waitFor(host, 'room_state');
		const room = state1.room as { code: string };

		const guest = connect();
		await new Promise((resolve) => guest.once('open', resolve));
		send(guest, { t: 'join_room', code: room.code, playerId: 'guest-2', name: 'Guest2', avatar: '♥' });
		await waitFor(guest, 'room_state');
		send(host, { t: 'set_ready', ready: true });
		send(guest, { t: 'set_ready', ready: true });
		send(host, { t: 'start_game' });
		await waitFor(host, 'game_start');
		await waitFor(guest, 'game_start');

		// Le client invité part en pleine partie après > 2 s (seuil réduit en test)
		await new Promise((resolve) => setTimeout(resolve, 2500));
		guest.close();
		// Le serveur finalise au close : l'hôte reçoit game_over avec victoire par forfait
		const over = await waitFor(host, 'game_over', { timeoutMs: 15000 });
		const deltas = over.deltas as Array<{ playerId: string; delta: number }>;
		expect(deltas.find((d) => d.playerId === 'host-2')?.delta).toBe(40);
	}, 40000);

	test('quit before 30s cancels the game with no trophies', async () => {
		const host = connect();
		await new Promise((resolve) => host.once('open', resolve));
		send(host, { t: 'create_room', playerId: 'host-3', name: 'Host3', avatar: '♠' });
		const state1 = await waitFor(host, 'room_state');
		const room = state1.room as { code: string };

		const guest = connect();
		await new Promise((resolve) => guest.once('open', resolve));
		send(guest, { t: 'join_room', code: room.code, playerId: 'guest-3', name: 'Guest3', avatar: '♥' });
		await waitFor(guest, 'room_state');
		send(host, { t: 'set_ready', ready: true });
		send(guest, { t: 'set_ready', ready: true });
		send(host, { t: 'start_game' });
		await waitFor(guest, 'game_start');

		// Départ immédiat (< 30 s) : partie ignorée
		guest.close();
		const over = await waitFor(host, 'game_over', { timeoutMs: 15000 });
		expect(over.cancelled).toBe(true);
		expect(over.deltas).toEqual([]);
	}, 40000);
});

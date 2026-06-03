export interface PlayerProfile {
	id: string;
	name: string;
	avatar: string;
}

const PLAYER_KEY = 'klondike-pl';

const ADJECTIVES = ['Velvet', 'Cosmic', 'Lucky', 'Neon', 'Royal', 'Turbo', 'Mystic', 'Pixel', 'Golden', 'Shadow'];
const NOUNS = ['Spade', 'Heart', 'Diamond', 'Club', 'Joker', 'Ace', 'King', 'Queen', 'Stack', 'Shuffle'];
const AVATARS = ['♠', '♥', '♦', '♣', '★', '✦', '✹', '◆'];

export function getStoredPlayer(): PlayerProfile {
	if (typeof window === 'undefined') return createPlayer();
	try {
		const raw = localStorage.getItem(PLAYER_KEY);
		if (raw) {
			const parsed = JSON.parse(raw) as PlayerProfile;
			if (parsed.id && parsed.name) return { ...parsed, name: sanitizePlayerName(parsed.name) };
		}
	} catch {}
	const player = createPlayer();
	savePlayer(player);
	return player;
}

export function savePlayer(player: PlayerProfile): PlayerProfile {
	const next = { ...player, name: sanitizePlayerName(player.name) };
	if (typeof window !== 'undefined') {
		try {
			localStorage.setItem(PLAYER_KEY, JSON.stringify(next));
		} catch {}
	}
	return next;
}

export function renamePlayer(player: PlayerProfile, name: string): PlayerProfile {
	return savePlayer({ ...player, name: sanitizePlayerName(name) });
}

export function exportPlayerCode(player: PlayerProfile): string {
	const payload = JSON.stringify({
		id: player.id,
		name: sanitizePlayerName(player.name),
		avatar: player.avatar
	});
	return `SOL-${toBase64Url(payload)}`;
}

export function importPlayerCode(code: string): PlayerProfile | null {
	try {
		const raw = code.trim().replace(/^SOL-/i, '').replace(/\s+/g, '');
		const parsed = JSON.parse(fromBase64Url(raw)) as Partial<PlayerProfile>;
		if (!parsed.id || !parsed.name) return null;
		return savePlayer({
			id: String(parsed.id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80),
			name: sanitizePlayerName(parsed.name),
			avatar: String(parsed.avatar ?? '♠').slice(0, 2)
		});
	} catch {
		return null;
	}
}

export async function registerPlayer(player: PlayerProfile): Promise<void> {
	try {
		await fetch('/api/player', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(player)
		});
	} catch {}
}

export function sanitizePlayerName(name: string): string {
	const clean = name.replace(/\s+/g, ' ').trim().slice(0, 20);
	return clean || 'Anonymous Ace';
}

export function isDefaultName(name: string): boolean {
	const parts = name.split(' ');
	if (parts.length !== 2) return false;
	return ADJECTIVES.includes(parts[0]) && NOUNS.includes(parts[1]);
}

function createPlayer(): PlayerProfile {
	const a = pick(ADJECTIVES);
	const n = pick(NOUNS);
	return {
		id: cryptoRandomId(),
		name: `${a} ${n}`,
		avatar: pick(AVATARS)
	};
}

function pick(items: string[]): string {
	const index = Math.floor(random() * items.length);
	return items[index];
}

function cryptoRandomId(): string {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
	return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function random(): number {
	if (typeof crypto === 'undefined' || !crypto.getRandomValues) return Math.random();
	const data = new Uint32Array(1);
	crypto.getRandomValues(data);
	return data[0] / 0xffffffff;
}

function toBase64Url(value: string): string {
	const bytes = new TextEncoder().encode(value);
	let binary = '';
	bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string {
	const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
	const binary = atob(padded);
	const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

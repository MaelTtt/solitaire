import { useEffect, useState } from 'preact/hooks';
import type { DuelRoomPlayer, DuelRoomState } from '@/lib/state/duel';
import { PixelIcon, PlayerAvatar } from './PixelIcon';

interface CountdownOverlayProps {
	endsAt: number;
}

export function CountdownOverlay({ endsAt }: CountdownOverlayProps) {
	const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));

	useEffect(() => {
		const timer = setInterval(() => setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))), 200);
		return () => clearInterval(timer);
	}, [endsAt]);

	if (remaining <= 0) return null;

	return (
		<div class="countdown-overlay">
			<div class="countdown-number" key={remaining}>{remaining}</div>
			<div class="countdown-sub">Même distribution pour tous… prépare-toi !</div>
		</div>
	);
}

interface OpponentsRailProps {
	opponents: Array<{
		id: string;
		name: string;
		avatar: string;
		foundations: Array<{ suit: 'spades' | 'hearts' | 'diamonds' | 'clubs'; rank: number }>;
		count: number;
		finished: boolean;
		finishTimeSeconds: number | null;
	}>;
	onQuit?: () => void;
}

export function OpponentsRail({ opponents, onQuit }: OpponentsRailProps) {
	if (!opponents.length && !onQuit) return null;
	return (
		<aside class="opponents-rail">
			{onQuit && (
				<button class="opp-quit" onClick={onQuit} title="Quitter le duel (forfait)">
					<PixelIcon name="logout" size={12} /> Quitter
				</button>
			)}
			{opponents.map((opponent) => (
				<div class={`opp-chip ${opponent.finished ? 'finished' : ''}`} key={opponent.id} title={opponent.name}>
					<div class="opp-head">
						<span class="opp-avatar"><PlayerAvatar avatar={opponent.avatar} size={13} /></span>
						<span class="opp-name">{opponent.name}</span>
						{opponent.finished && <span class="opp-done"><PixelIcon name="check" size={10} /> {fmtSeconds(opponent.finishTimeSeconds)}</span>}
					</div>
					<div class="opp-cards">
						{[0, 1, 2, 3].map((i) => {
							const card = opponent.foundations[i];
							return (
								<span class={`mini-card suit-${card?.suit ?? 'empty'}`} key={i}>
									{card ? <>{rankLabel(card.rank)}{suitSymbol(card.suit)}</> : ''}
								</span>
							);
						})}
					</div>
					<div class="found-bar opp"><div class="found-fill" style={`width:${(opponent.count / 52) * 100}%`} /></div>
				</div>
			))}
		</aside>
	);
}

function fmtSeconds(seconds: number | null): string {
	if (seconds == null) return '';
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}:${String(s).padStart(2, '0')}`;
}

function rankLabel(rank: number): string {
	if (rank === 1) return 'A';
	if (rank === 11) return 'J';
	if (rank === 12) return 'Q';
	if (rank === 13) return 'K';
	return String(rank);
}

function suitSymbol(suit: 'spades' | 'hearts' | 'diamonds' | 'clubs'): string {
	return { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }[suit];
}

export function PlayerList({ room, playerId }: { room: DuelRoomState; playerId: string }) {
	return (
		<ul class="duel-players">
			{room.players.map((entry: DuelRoomPlayer) => (
				<li class={`duel-player ${entry.connected ? '' : 'offline'} ${entry.id === playerId ? 'self' : ''}`} key={entry.id}>
					<span class="duel-player-avatar"><PlayerAvatar avatar={entry.avatar} size={16} /></span>
					<span class="duel-player-name">{entry.name}{entry.id === playerId ? ' (toi)' : ''}</span>
					{room.hostId === entry.id && <span class="duel-player-host" title="Hôte"><PixelIcon name="crown" size={12} /></span>}
					{entry.trophies != null && <span class="duel-player-trophies" title={`${entry.trophies} trophées`}><PixelIcon name="trophy" size={12} /> {entry.trophies}</span>}
					<span class={`duel-player-ready ${entry.ready ? 'yes' : ''}`}>{entry.ready ? <PixelIcon name="check" size={11} /> : '…'}</span>
				</li>
			))}
		</ul>
	);
}

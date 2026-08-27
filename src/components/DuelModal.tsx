import { useEffect, useState } from 'preact/hooks';
import {
	fetchDuelHistory,
	fetchTrophies,
	type DuelHistoryRow,
	type DuelPhase,
	type DuelResult,
	type DuelRoomState,
	type TrophyProfile
} from '@/lib/state/duel';
import type { PlayerProfile } from '@/lib/state/player';
import { PlayerList } from './DuelWidgets';
import { PixelIcon } from './PixelIcon';

interface DuelModalProps {
	player: PlayerProfile;
	phase: DuelPhase;
	room: DuelRoomState | null;
	result: DuelResult | null;
	error: string;
	connected: boolean;
	isHost: boolean;
	onCreate: () => void;
	onJoin: (code: string) => void;
	onSetReady: (ready: boolean) => void;
	onSetDifficulty: (pref: 'any' | 'facile' | 'moyen' | 'difficile') => void;
	onStart: () => void;
	onLeave: () => void;
	onClose: () => void;
}

export function DuelModal(props: DuelModalProps) {
	const { player, phase, room, error, onClose } = props;
	const [tab, setTab] = useState<'create' | 'join' | 'stats'>('create');
	const [code, setCode] = useState('');
	const [trophies, setTrophies] = useState<TrophyProfile | null>(null);
	const [history, setHistory] = useState<DuelHistoryRow[]>([]);

	useEffect(() => {
		fetchTrophies(player.id).then(setTrophies);
		fetchDuelHistory(player.id, 10).then(setHistory);
	}, [player.id]);

	// En pleine partie le modal se referme : le plateau prend la main
	useEffect(() => {
		if (phase === 'playing') onClose();
	}, [phase]);

	function capFirst(value: string): string {
		return value.charAt(0).toUpperCase() + value.slice(1);
	}

	if (phase === 'lobby' || phase === 'countdown') {
		return (
			<div class="overlay duel-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
				<div class="panel duel-panel">
					<div class="title">Salle {room?.code}</div>
					<p class="sub">Partage le code pour inviter tes adversaires. Premier à finir les 52 cartes : +40 trophées.</p>
					{room?.difficulty && <p class="duel-difficulty">Difficulté : <strong>{capFirst(room.difficulty)}</strong></p>}
					<PlayerList room={room!} playerId={player.id} />
					{phase === 'lobby' && (
						<div class="duel-difficulty-picker">
							<span class="duel-difficulty-label">Difficulté :</span>
							{(['any', 'facile', 'moyen', 'difficile'] as const).map((pref) => (
								<button
									key={pref}
									class={`duel-diff-option ${room?.difficultyPref === pref ? 'active' : ''} ${props.isHost ? '' : 'locked'}`}
									disabled={!props.isHost}
									onClick={() => props.onSetDifficulty(pref)}
								>
									{pref === 'any' ? 'Peu importe' : capFirst(pref)}
								</button>
							))}
						</div>
					)}
					<div class="duel-code-row">
						<span class="duel-code">{room?.code ?? '…'}</span>
						<button class="transfer-btn" onClick={() => navigator.clipboard?.writeText(room?.code ?? '').catch(() => {})}>Copier</button>
					</div>
					<PlayerList room={room!} playerId={player.id} />
					{phase === 'countdown' && <p class="duel-countdown-note">La partie démarre…</p>}
					{error && <p class="transfer-message">{error}</p>}
					<div class="actions">
						<button class="play-btn alt" onClick={props.onLeave}>Quitter</button>
						{phase === 'lobby' && (
							<>
								{!props.isHost && <button class="play-btn" onClick={() => props.onSetReady(!room?.players.find((entry) => entry.id === player.id)?.ready)}>
									{room?.players.find((entry) => entry.id === player.id)?.ready ? 'Annuler prêt' : 'Je suis prêt'}
								</button>}
								{props.isHost && <button class="play-btn" onClick={props.onStart} disabled={(room?.players.filter((entry) => entry.connected).length ?? 0) < 2 || !room?.players.filter((entry) => entry.connected).every((entry) => entry.ready)}>Lancer le duel</button>}
							</>
						)}
					</div>
				</div>
			</div>
		);
	}

	// phase === 'idle' : écran création / rejoindre / stats
	return (
		<div class="overlay duel-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
			<div class="panel duel-panel">
				<div class="title">Duels</div>
				{trophies && (
					<div class="duel-trophy-banner">
						<span class="duel-league">{trophies.league}</span>
						<span class="duel-trophies"><PixelIcon name="trophy" size={14} /> {trophies.trophies}</span>
						<span class="duel-record">record {trophies.bestTrophies}</span>
						<span class="duel-duels">{trophies.duelsPlayed} duels · {trophies.duelWins} victoires</span>
					</div>
				)}
				<div class="duel-tabs">
					<button class={`duel-tab ${tab === 'create' ? 'active' : ''}`} onClick={() => setTab('create')}>Créer</button>
					<button class={`duel-tab ${tab === 'join' ? 'active' : ''}`} onClick={() => setTab('join')}>Rejoindre</button>
					<button class={`duel-tab ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')}>Historique</button>
				</div>

				{tab === 'create' && (
					<div class="duel-tab-body">
						<p class="sub">Crée une salle et partage son code. Tous les joueurs reçoivent exactement la même distribution certifiée gagnable.</p>
						<button class="play-btn" onClick={props.onCreate}>Créer une salle</button>
					</div>
				)}
				{tab === 'join' && (
					<div class="duel-tab-body">
						<p class="sub">Entre le code de la salle reçu de ton adversaire.</p>
						<input
							class="duel-code-input"
							value={code}
							placeholder="CODE"
							maxLength={5}
							onInput={(event) => setCode(event.currentTarget.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
							onKeyDown={(event) => event.key === 'Enter' && code.length >= 4 && props.onJoin(code)}
						/>
						<button class="play-btn" onClick={() => props.onJoin(code)} disabled={code.length < 4}>Rejoindre</button>
					</div>
				)}
				{tab === 'stats' && (
					<div class="duel-tab-body">
						{history.length === 0 && <p class="sub">Aucun duel joué pour l'instant.</p>}
						<ul class="duel-history">
							{history.map((row, index) => (
								<li key={index} class={row.trophyDelta > 0 ? 'win' : row.trophyDelta < 0 ? 'loss' : ''}>
									<span class="duel-history-place">{row.finished ? (row.placement === 1 ? <PixelIcon name="trophy" size={12} /> : `${row.placement}e`) : '—'}</span>
									<span class="duel-history-score">{row.score} pts</span>
									<span class="duel-history-time">{Math.floor(row.timeSeconds / 60)}:{String(row.timeSeconds % 60).padStart(2, '0')}</span>
									<span class={`duel-history-delta ${row.trophyDelta > 0 ? 'up' : row.trophyDelta < 0 ? 'down' : ''}`}>{row.trophyDelta > 0 ? '+' : ''}{row.trophyDelta}</span>
								</li>
							))}
						</ul>
					</div>
				)}

				{error && <p class="transfer-message">{error}</p>}
				<div class="actions">
					<button class="play-btn alt" onClick={onClose}>Fermer</button>
				</div>
			</div>
		</div>
	);
}

import { useEffect, useState } from 'preact/hooks';
import type { LeaderboardEntry } from '@/lib/state/leaderboard';
import { allTimeRows, dailyRows, fmtTime, seedLabel, todayDate } from '@/lib/state/leaderboard';
import { fetchTrophiesLeaderboard, type TrophiesLeaderboardRow } from '@/lib/state/duel';
import { PixelIcon } from './PixelIcon';

interface LeaderboardModalProps {
	entries: LeaderboardEntry[];
	onClose: () => void;
	onPlaySeed: (seed: string) => void;
}

export function LeaderboardModal({ entries, onClose, onPlaySeed }: LeaderboardModalProps) {
	const daily = dailyRows(entries, todayDate());
	const allTime = allTimeRows(entries);
	const [tab, setTab] = useState<'scores' | 'duels'>('scores');
	const [trophyRows, setTrophyRows] = useState<TrophiesLeaderboardRow[]>([]);

	useEffect(() => {
		fetchTrophiesLeaderboard().then(setTrophyRows);
	}, []);

	// Trophées par pseudo (affichés dans les onglets scores)
	const trophiesByName = new Map(trophyRows.map((row) => [row.name, row.trophies]));
	const trophyChip = (name: string) => {
		const trophies = trophiesByName.get(name);
		return trophies != null ? <span class="lb-trophies" title={`${trophies} trophées en duel`}><PixelIcon name="trophy" size={10} /> {trophies}</span> : null;
	};

	const fmtDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

	return (
		<div class="overlay leaderboard-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
			<div class="panel leaderboard-panel">
				<div class="panel-header">
					<span class="title">Leaderboard</span>
					<button class="close-btn" onClick={onClose} aria-label="Close"><PixelIcon name="close" size={12} /></button>
				</div>

				<div class="lb-mode-tabs">
					<button class={`lb-mode-tab ${tab === 'scores' ? 'active' : ''}`} onClick={() => setTab('scores')}>Scores</button>
					<button class={`lb-mode-tab ${tab === 'duels' ? 'active' : ''}`} onClick={() => setTab('duels')}><PixelIcon name="trophy" size={12} /> Duels</button>
				</div>

				{tab === 'scores' && (
					<div class="lb-tabs">
						<div class="lb-section">
							<div class="lb-head">Today's game</div>
							{daily.length === 0 ? <div class="lb-empty">No scores today</div> : daily.map((entry, i) => (
								<div class={`lb-row ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}`} key={`${entry.playerId}-${entry.score}-${i}`}>
									<span class="lb-rank">#{i + 1}</span>
									<span class="lb-name">{entry.name}{trophyChip(entry.name)}<span class="lb-meta">streak {entry.streak}</span></span>
									<span class="lb-score">{entry.score}pts</span>
									<span class="lb-time">{fmtTime(entry.timeSeconds)}</span>
									<span class="lb-restarts"><PixelIcon name="reload" size={10} /> {entry.restarts}</span>
								</div>
							))}
						</div>

						<div class="lb-divider" />

						<div class="lb-section">
							<div class="lb-head">All time</div>
							{allTime.length === 0 ? <div class="lb-empty">No games yet</div> : allTime.map((entry, i) => (
								<div class={`lb-row ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}`} key={`${entry.playerId}-${entry.seed}-${i}`}>
									<span class="lb-rank">#{i + 1}</span>
									<span class="lb-name">{entry.name}{trophyChip(entry.name)}<span class="lb-meta">{seedLabel(entry)}</span></span>
									<span class="lb-score">{entry.score}pts</span>
									<div class="lb-side">
										<span class="lb-time">{fmtDate(entry.date)}</span>
										{entry.mode === 'random' && <button class="seed-btn" onClick={() => onPlaySeed(entry.seed)}>Play</button>}
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				{tab === 'duels' && (
					<div class="lb-section">
						<div class="lb-head">Classement trophées</div>
						{trophyRows.length === 0 ? <div class="lb-empty">Aucun duel joué</div> : trophyRows.map((row, i) => (
							<div class={`lb-row ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}`} key={row.playerId}>
								<span class="lb-rank">#{i + 1}</span>
								<span class="lb-name">{row.name}<span class="lb-meta">{row.league} · {row.duelWins}V/{row.duelsPlayed} duels</span></span>
								<span class="lb-score lb-trophies-big"><PixelIcon name="trophy" size={13} /> {row.trophies}</span>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

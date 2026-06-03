import type { LeaderboardEntry } from '@/lib/state/leaderboard';
import { allTimeRows, dailyRows, fmtTime, seedLabel, todayDate } from '@/lib/state/leaderboard';

interface LeaderboardModalProps {
	entries: LeaderboardEntry[];
	onClose: () => void;
	onPlaySeed: (seed: string) => void;
}

export function LeaderboardModal({ entries, onClose, onPlaySeed }: LeaderboardModalProps) {
	const daily = dailyRows(entries, todayDate());
	const allTime = allTimeRows(entries);

	const fmtDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

	return (
		<div class="overlay leaderboard-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
			<div class="panel leaderboard-panel">
				<div class="panel-header">
					<span class="title">Leaderboard</span>
					<button class="close-btn" onClick={onClose}>×</button>
				</div>

				<div class="lb-tabs">
					<div class="lb-section">
						<div class="lb-head">Today's game</div>
						{daily.length === 0 ? <div class="lb-empty">No scores today</div> : daily.map((entry, i) => (
							<div class={`lb-row ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}`} key={`${entry.playerId}-${entry.score}-${i}`}>
								<span class="lb-rank">#{i + 1}</span>
								<span class="lb-name">{entry.name}<span class="lb-meta">streak {entry.streak}</span></span>
								<span class="lb-score">{entry.score}pts</span>
								<span class="lb-time">{fmtTime(entry.timeSeconds)}</span>
								<span class="lb-restarts">↻ {entry.restarts}</span>
							</div>
						))}
					</div>

					<div class="lb-divider" />

					<div class="lb-section">
						<div class="lb-head">All time</div>
						{allTime.length === 0 ? <div class="lb-empty">No games yet</div> : allTime.map((entry, i) => (
							<div class={`lb-row ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}`} key={`${entry.playerId}-${entry.seed}-${i}`}>
								<span class="lb-rank">#{i + 1}</span>
								<span class="lb-name">{entry.name}<span class="lb-meta">{seedLabel(entry)}</span></span>
								<span class="lb-score">{entry.score}pts</span>
								<div class="lb-side">
									<span class="lb-time">{fmtDate(entry.date)}</span>
									{entry.mode === 'random' && <button class="seed-btn" onClick={() => onPlaySeed(entry.seed)}>Play</button>}
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

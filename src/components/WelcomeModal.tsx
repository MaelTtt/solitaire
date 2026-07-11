import { todaySeed } from '@/lib/game/seedRng';
import type { PlayerProfile } from '@/lib/state/player';
import type { DailyStatus, LeaderboardEntry } from '@/lib/state/leaderboard';
import { allTimeRows, dailyRows, fmtTime, randomBest, seedLabel, todayDate } from '@/lib/state/leaderboard';

interface WelcomeModalProps {
	player: PlayerProfile;
	dailyStatus: DailyStatus;
	entries: LeaderboardEntry[];
	onStart: (mode: 'daily' | 'random', seed: string) => void;
	onRename: () => void;
	startingMode: 'daily' | 'random' | null;
	startError: string;
}

export function WelcomeModal({ player, dailyStatus, entries, onStart, onRename, startingMode, startError }: WelcomeModalProps) {
	const today = todayDate();
	const daily = dailyRows(entries, today);
	const allTime = allTimeRows(entries);
	const dailyBest = daily[0] ?? null;
	const bestRandom = randomBest(entries);

	return (
		<div class="overlay welcome-overlay">
			<div class="panel welcome-panel">
				<div class="suit-row">♠ ♥ ♦ ♣</div>
				<h1>Solitaire</h1>
				<p class="date">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>

				<button class="player-card" onClick={onRename}>
					<span class="player-avatar">{player.avatar}</span>
					<span>
						<span class="player-label">Playing as</span>
						<strong>{player.name}</strong>
					</span>
					<span class="player-edit">rename</span>
				</button>

				<div class="streak-strip">
					<span>Daily streak</span>
					<strong>{dailyStatus.streak}</strong>
					<span>{dailyStatus.completed ? 'completed today' : dailyStatus.started ? `${dailyStatus.restarts} restart${dailyStatus.restarts === 1 ? '' : 's'} today` : 'ready for today'}</span>
				</div>

				<div class="modes">
					<button class="mode-btn daily" onClick={() => onStart('daily', todaySeed())} disabled={dailyStatus.completed || startingMode !== null}>
						<span class="mode-icon">📅</span>
						<span class="mode-title">Today's game</span>
						<span class={`mode-desc ${dailyStatus.completed ? 'played' : ''}`}>
							{startingMode === 'daily' ? 'Checking this deal can be won…' : dailyStatus.completed ? 'Already finished today' : 'Same verified deal for everyone today'}
						</span>
						{dailyBest && <span class="mode-best">Best today: {dailyBest.name} — {dailyBest.score}pts</span>}
					</button>

					<button class="mode-btn random" onClick={() => onStart('random', `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)} disabled={startingMode !== null}>
						<span class="mode-icon">🎲</span>
						<span class="mode-title">Random game</span>
						<span class="mode-desc">{startingMode === 'random' ? 'Finding a verified winnable deal…' : 'Fresh verified deal every time'}</span>
						{bestRandom && <span class="mode-best">Best random: {bestRandom.name} — {bestRandom.score}pts</span>}
					</button>
				</div>
				{startError && <p class="deal-error" role="alert">{startError}</p>}

				{(daily.length > 0 || allTime.length > 0) && (
					<details class="lb-preview">
						<summary>Leaderboard</summary>
						<div class="lb-tabs">
							{daily.length > 0 && (
								<div class="lb-section">
									<div class="lb-head">Today's game</div>
									{daily.slice(0, 5).map((entry, i) => (
										<div class="lb-row" key={`${entry.playerId}-${entry.score}-${i}`}>
											<span class="lb-rank">#{i + 1}</span>
											<span class="lb-name">{entry.name}</span>
											<span class="lb-score">{entry.score}</span>
											<span class="lb-time">{fmtTime(entry.timeSeconds)}</span>
											<span class="lb-restarts">↻ {entry.restarts}</span>
										</div>
									))}
								</div>
							)}
							{allTime.length > 0 && (
								<div class="lb-section">
									<div class="lb-head">All time</div>
									{allTime.slice(0, 5).map((entry, i) => (
										<div class="lb-row" key={`${entry.playerId}-${entry.seed}-${i}`}>
											<span class="lb-rank">#{i + 1}</span>
											<span class="lb-name">{entry.name}<span class="lb-meta">{seedLabel(entry)}</span></span>
											<span class="lb-score">{entry.score}</span>
										</div>
									))}
								</div>
							)}
						</div>
					</details>
				)}
			</div>
		</div>
	);
}

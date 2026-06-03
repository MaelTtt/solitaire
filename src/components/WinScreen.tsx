import type { GameMode } from '@/lib/game/types';
import type { PlayerProfile } from '@/lib/state/player';
import type { LeaderboardEntry } from '@/lib/state/leaderboard';
import { allTimeRows, dailyRows, fmtTime, todayDate } from '@/lib/state/leaderboard';

interface WinScreenProps {
	player: PlayerProfile;
	finalScore: number;
	moves: number;
	startTime: number;
	endTime: number;
	mode: GameMode;
	restarts: number;
	streak: number;
	entries: LeaderboardEntry[];
	submitted: boolean;
	onNewGame: (mode: GameMode) => void;
	onRename: () => void;
}

export function WinScreen({ player, finalScore, moves, startTime, endTime, mode, restarts, streak, entries, submitted, onNewGame, onRename }: WinScreenProps) {
	const elapsed = Math.floor((endTime - startTime) / 1000);
	const board = mode === 'daily' ? dailyRows(entries, todayDate()) : allTimeRows(entries);

	return (
		<div class="overlay win-overlay">
			<div class="panel win-panel">
				<div class="title">Won</div>
				<div class="submitted-line">
					<span>{submitted ? 'Score saved for' : 'Saving score for'}</span>
					<button onClick={onRename}>{player.avatar} {player.name}</button>
				</div>

				<div class="stats">
					<div class="stat-row"><span>Score</span><span class="val highlight">{finalScore}</span></div>
					<div class="stat-row"><span>Moves</span><span class="val">{moves}</span></div>
					<div class="stat-row"><span>Time</span><span class="val">{fmtTime(elapsed)}</span></div>
					<div class="stat-row"><span>Mode</span><span class="val">{mode === 'daily' ? 'Daily' : 'Random'}</span></div>
					{mode === 'daily' && <div class="stat-row"><span>Restarts</span><span class="val">↻ {restarts}</span></div>}
					{mode === 'daily' && <div class="stat-row"><span>Streak</span><span class="val">🔥 {streak}</span></div>}
				</div>

				<div class="lb-panel">
					<div class="lb-title">{mode === 'daily' ? "Today's leaderboard" : 'All-time leaderboard'}</div>
					{board.slice(0, 8).map((entry, i) => (
						<div class={`lb-row ${entry.playerId === player.id && entry.score === finalScore ? 'me' : ''}`} key={`${entry.playerId}-${entry.seed}-${i}`}>
							<span class="lb-rank">#{i + 1}</span>
							<span class="lb-name">{entry.name}</span>
							<span class="lb-score">{entry.score}</span>
							<span class="lb-time">{fmtTime(entry.timeSeconds)}</span>
							{mode === 'daily' && <span class="lb-restarts">↻ {entry.restarts}</span>}
						</div>
					))}
				</div>

				<div class="actions">
					{mode === 'daily' ? (
						<button class="play-btn alt" onClick={() => onNewGame('random')}>Random</button>
					) : (
						<>
							<button class="play-btn" onClick={() => onNewGame('random')}>Replay</button>
							<button class="play-btn alt" onClick={() => onNewGame('daily')}>Daily</button>
						</>
					)}
				</div>
			</div>
		</div>
	);
}

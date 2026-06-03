import { useEffect, useMemo, useState } from 'preact/hooks';
import type { GameMode, PileLocation } from '@/lib/game/types';
import { canMoveToFoundation, canMoveToTableau } from '@/lib/game/rules';
import { todaySeed } from '@/lib/game/seedRng';
import { useGame } from '@/lib/state/game';
import { getStoredPlayer, isDefaultName, registerPlayer, renamePlayer, type PlayerProfile } from '@/lib/state/player';
import {
	beginDailyAttempt,
	fetchDailyStatus,
	fetchLeaderboard,
	fmtTime,
	getLocalDailyStatus,
	submitLeaderboard,
	todayDate,
	type DailyStatus,
	type LeaderboardEntry
} from '@/lib/state/leaderboard';
import { useDragState } from '@/lib/ui/drag';
import { useScreenMetrics } from '@/lib/ui/screen';
import { CardStack } from '@/components/CardStack';
import { FoundationPile } from '@/components/FoundationPile';
import { LeaderboardModal } from '@/components/LeaderboardModal';
import { PlayerNameModal } from '@/components/PlayerNameModal';
import { StockPile } from '@/components/StockPile';
import { StuckScreen } from '@/components/StuckScreen';
import { TableauPile } from '@/components/TableauPile';
import { VortexBackground } from '@/components/VortexBackground';
import { WastePile } from '@/components/WastePile';
import { WelcomeModal } from '@/components/WelcomeModal';
import { WinScreen } from '@/components/WinScreen';

const SUITS = ['♠', '♥', '♦', '♣'] as const;
const SUIT_COLORS = ['#c8b8ff', '#ff6b8a', '#ffaa55', '#6bdd8a'] as const;

export function App() {
	const game = useGame();
	const screen = useScreenMetrics();
	const dragApi = useDragState();
	const { drag } = dragApi;

	const [player, setPlayer] = useState<PlayerProfile>(() => getStoredPlayer());
	const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
	const [dailyStatus, setDailyStatus] = useState<DailyStatus>(() => getLocalDailyStatus(getStoredPlayer().id));
	const [showModal, setShowModal] = useState(!game.loadedSaved);
	const [showLeaderboard, setShowLeaderboard] = useState(false);
	const [showPlayerModal, setShowPlayerModal] = useState(false);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [elapsed, setElapsed] = useState(0);
	const [dropTarget, setDropTarget] = useState<PileLocation | null>(null);
	const [submittedWinKey, setSubmittedWinKey] = useState('');
	const [pendingWinSubmit, setPendingWinSubmit] = useState(false);

	const foundationTotal = useMemo(() => game.state.foundations.reduce((sum, pile) => sum + pile.length, 0), [game.state.foundations]);
	const hintedCardId = game.hint?.cardId || null;
	const hintStock = game.hint?.from.type === 'stock';
	const finalScore = game.won ? game.getFinalScore() : 0;

	useEffect(() => {
		registerPlayer(player);
		fetchLeaderboard().then(setEntries);
		fetchDailyStatus(player).then(setDailyStatus);
	}, [player]);

	useEffect(() => {
		const timer = setInterval(() => setElapsed(Math.floor((Date.now() - game.state.startTime) / 1000)), 1000);
		return () => clearInterval(timer);
	}, [game.state.startTime]);

	useEffect(() => {
		const onFullScreen = () => setIsFullscreen(!!document.fullscreenElement || !!(document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement);
		document.addEventListener('fullscreenchange', onFullScreen);
		document.addEventListener('webkitfullscreenchange', onFullScreen);
		return () => {
			document.removeEventListener('fullscreenchange', onFullScreen);
			document.removeEventListener('webkitfullscreenchange', onFullScreen);
		};
	}, []);

	useEffect(() => {
		const onKeydown = (event: KeyboardEvent) => {
			if (event.key === 'n' || event.key === 'N') setShowModal(true);
			if ((event.ctrlKey || event.metaKey) && event.key === 'z') game.undo();
			if ((event.key === 'h' || event.key === 'H') && !event.repeat) game.showHint();
		};
		window.addEventListener('keydown', onKeydown);
		return () => window.removeEventListener('keydown', onKeydown);
	}, [game]);

	useEffect(() => {
		if (!game.won || !game.state.endTime) return;
		if (isDefaultName(player.name)) {
			setPendingWinSubmit(true);
			setShowPlayerModal(true);
			return;
		}
		setPendingWinSubmit(false);
		submitWinScore();
	}, [game.won, game.state.endTime]);

	useEffect(() => {
		if (pendingWinSubmit && !isDefaultName(player.name) && game.won && game.state.endTime) {
			setPendingWinSubmit(false);
			submitWinScore();
		}
	}, [player.name, pendingWinSubmit]);

	function submitWinScore() {
		if (!game.state.endTime) return;
		const key = `${game.state.seed}:${game.state.endTime}:${player.id}`;
		if (submittedWinKey === key) return;
		setSubmittedWinKey(key);

		const elapsedSeconds = Math.floor((game.state.endTime - game.state.startTime) / 1000);
		const optimisticStreak = game.state.mode === 'daily'
			? Math.max(1, getLocalDailyStatus(player.id, todayDate()).streak)
			: 0;

		submitLeaderboard({
			playerId: player.id,
			name: player.name,
			score: finalScore,
			moves: game.state.moves,
			timeSeconds: elapsedSeconds,
			date: todayDate(),
			mode: game.state.mode,
			seed: game.state.seed,
			restarts: game.state.mode === 'daily' ? game.state.dailyRestartCount : 0,
			streak: optimisticStreak
		}).then(async (rows) => {
			setEntries(rows);
			if (game.state.mode === 'daily') setDailyStatus(await fetchDailyStatus(player, todayDate(), game.state.seed));
		});
	}

	const toggleFullscreen = async () => {
		try {
			const doc = document as Document & { webkitExitFullscreen?: () => Promise<void>; webkitFullscreenElement?: Element };
			const root = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
			if (!document.fullscreenElement && !doc.webkitFullscreenElement) {
				await (root.requestFullscreen ?? root.webkitRequestFullscreen)?.call(root);
			} else {
				await (document.exitFullscreen ?? doc.webkitExitFullscreen)?.call(document);
			}
		} catch {}
	};

	const startGame = async (mode: GameMode, seed: string) => {
		let nextMode = mode;
		let nextSeed = seed;
		let restarts = 0;

		if (nextMode === 'daily') {
			const status = await fetchDailyStatus(player, todayDate(), nextSeed);
			if (status.completed) {
				nextMode = 'random';
				nextSeed = randomSeed();
			} else {
				try {
					const res = await fetch('/api/daily-seed', { cache: 'no-store' });
					const data = await res.json();
					nextSeed = data.seed ?? nextSeed;
				} catch {}
				const attempt = await beginDailyAttempt(player, nextSeed);
				restarts = attempt.restarts;
				setDailyStatus(attempt);
			}
		}

		if (nextMode === 'random') nextSeed ||= randomSeed();
		game.newGame(game.state.drawMode, nextMode, nextSeed, restarts);
		setSubmittedWinKey('');
		setShowModal(false);
	};

	const onNewGame = (mode: GameMode) => startGame(mode, mode === 'daily' ? todaySeed() : randomSeed());

	const savePlayerName = (name: string) => {
		const next = renamePlayer(player, name);
		setPlayer(next);
		setShowPlayerModal(false);
		registerPlayer(next);
	};

	const importPlayer = (next: PlayerProfile) => {
		setPlayer(next);
		setShowPlayerModal(false);
		registerPlayer(next);
		fetchDailyStatus(next).then(setDailyStatus);
	};

	const isDropTarget = (type: PileLocation['type'], index: number) => {
		return (dropTarget?.type === type && dropTarget.index === index) || (game.hint?.to.type === type && game.hint.to.index === index);
	};

	const onPointerMove = (event: PointerEvent) => {
		if (!drag.active) return;
		dragApi.move(event.clientX, event.clientY);
		const element = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
		const pileElement = element?.closest('[data-pile-type]') as HTMLElement | null;
		if (!pileElement) {
			setDropTarget(null);
			return;
		}
		const ptype = pileElement.dataset.pileType as PileLocation['type'];
		const pidx = Number(pileElement.dataset.pileIndex ?? 0);
		const cards = drag.cards;
		if (!cards.length) {
			setDropTarget(null);
			return;
		}
		let valid = false;
		if (ptype === 'foundation' && cards.length === 1) valid = canMoveToFoundation(cards[0], game.state.foundations[pidx]);
		if (ptype === 'tableau') valid = canMoveToTableau(cards[0], game.state.tableau[pidx]);
		setDropTarget(valid ? { type: ptype, index: pidx } : null);
	};

	const onPointerUp = () => {
		if (!drag.active) return;
		if (dropTarget && drag.from) game.moveCards(drag.from, dropTarget, drag.cards[0]?.id);
		setDropTarget(null);
		dragApi.end();
	};

	return (
		<>
			<VortexBackground />
			<div class="root" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { setDropTarget(null); dragApi.end(); }}>
				<header class="top-bar">
					<div class="bar-logo">♠</div>
					<div class="bar-sep" />
					<div class={`mode-badge ${game.state.mode === 'daily' ? 'daily' : ''}`}>{game.state.mode === 'daily' ? 'Daily' : 'Random'}</div>
					<button class="top-player" onClick={() => setShowPlayerModal(true)} title="Player card">
						<span>{player.avatar}</span>
						<strong>{player.name}</strong>
						<em>🔥 {dailyStatus.streak}</em>
					</button>
					<div class="bar-sep" />

					<div class="bar-stats-group">
						<div class="bar-stat"><span class="bar-lbl">SCORE</span><span class="bar-val">{game.state.score}</span></div>
						<div class="bar-stat"><span class="bar-lbl">MOVES</span><span class="bar-val">{game.state.moves}</span></div>
						<div class="bar-stat"><span class="bar-lbl">TIME</span><span class="bar-val">{fmtTime(elapsed)}</span></div>
						{game.state.mode === 'daily' && <div class="bar-stat restarts-stat"><span class="bar-lbl">RESTARTS</span><span class="bar-val">↻ {game.state.dailyRestartCount}</span></div>}
					</div>

					<div class="bar-sep" />
					<div class="bar-progress-widget">
						<div class="bar-suits">
							{game.state.foundations.map((pile, i) => <div class="bar-suit" style={`color:${SUIT_COLORS[i]}`} key={SUITS[i]}>{SUITS[i]}<span>{pile.length}</span></div>)}
						</div>
						<div class="found-bar"><div class="found-fill" style={`width:${(foundationTotal / 52) * 100}%`} /></div>
					</div>

					<div class="bar-spacer" />
					<div class="bar-actions">
						<button class="act-btn fs-btn" title="Fullscreen" onClick={toggleFullscreen}>{isFullscreen ? '⤢' : '⛶'}</button>
						<button class="act-btn lb-btn" title="Leaderboard" onClick={() => { setShowLeaderboard(true); fetchLeaderboard().then(setEntries); }}>🏆</button>
						<button class="act-btn hint-btn" title="Hint (H)" onClick={game.showHint} disabled={game.autoCompleting}>?</button>
						<button class="act-btn undo-btn" title="Undo" disabled={game.undoStack.length === 0} onClick={game.undo}>↶</button>
						<button class="act-btn new-btn" onClick={() => setShowModal(true)}><span class="btn-label-full">New game</span><span class="btn-label-short">+</span></button>
					</div>
				</header>

				{game.hint && <div class="hint-toast">{game.hint.message}</div>}

				<div class="board-wrap">
					<main class="board">
						<section class="top-row">
							<StockPile cards={game.state.stock} hinted={hintStock} onDraw={game.drawFromStock} />
							<WastePile
								cards={game.state.waste}
								drawMode={game.state.drawMode}
								hintedCardId={hintedCardId}
								drag={drag}
								screen={screen}
								onStartDrag={dragApi.start}
								onAutoFoundation={game.autoMoveToFoundation}
							/>
							<div class="gap" />
							{game.state.foundations.map((pile, i) => (
								<FoundationPile
									key={i}
									cards={pile}
									index={i}
									isDropTarget={isDropTarget('foundation', i)}
									drag={drag}
									onStartDrag={dragApi.start}
								/>
							))}
						</section>

						<section class="tableau-row">
							{game.state.tableau.map((pile, i) => (
								<div key={i} data-pile-type="tableau" data-pile-index={i} class="tableau-col">
									<TableauPile
										cards={pile}
										index={i}
										hintedCardId={hintedCardId}
										isDropTarget={isDropTarget('tableau', i)}
										drag={drag}
										screen={screen}
										onStartDrag={dragApi.start}
										onAutoFoundation={game.autoMoveToFoundation}
									/>
								</div>
							))}
						</section>
					</main>
				</div>

				{drag.active && drag.cards.length > 0 && (
					<div class="drag-ghost-fixed" style={`left:${drag.x}px;top:${drag.y}px;transform:translate(${-screen.cardW / 2}px,-20px)`}>
						<CardStack cards={drag.cards} tilt={drag.tilt} />
					</div>
				)}

				{game.stuck && !game.won && <StuckScreen canUndo={game.undoStack.length > 0} onUndo={game.undo} onNewGame={() => setShowModal(true)} />}
				{game.won && game.state.endTime && (
					<WinScreen
						player={player}
						finalScore={finalScore}
						moves={game.state.moves}
						startTime={game.state.startTime}
						endTime={game.state.endTime}
						mode={game.state.mode}
						restarts={game.state.dailyRestartCount}
						streak={dailyStatus.streak}
						entries={entries}
						submitted={submittedWinKey !== ''}
						onNewGame={onNewGame}
						onRename={() => setShowPlayerModal(true)}
					/>
				)}

				<footer class="mob-bottom">
					<button class="mob-btn mob-undo" disabled={game.undoStack.length === 0} onClick={game.undo}>↶ Undo</button>
					<button class="mob-btn mob-new" onClick={() => setShowModal(true)}>+ New game</button>
				</footer>
			</div>

			{showModal && <WelcomeModal player={player} dailyStatus={dailyStatus} entries={entries} onStart={startGame} onRename={() => setShowPlayerModal(true)} />}
			{showLeaderboard && <LeaderboardModal entries={entries} onClose={() => setShowLeaderboard(false)} onPlaySeed={(seed) => { setShowLeaderboard(false); startGame('random', seed); }} />}
			{showPlayerModal && <PlayerNameModal player={player} onSave={savePlayerName} onImport={importPlayer} onClose={() => setShowPlayerModal(false)} />}
		</>
	);
}

function randomSeed(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

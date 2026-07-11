interface StuckScreenProps {
	canUndo: boolean;
	restarting: boolean;
	onUndo: () => void;
	onRestart: () => void;
	onNewGame: () => void;
}

export function StuckScreen({ canUndo, restarting, onUndo, onRestart, onNewGame }: StuckScreenProps) {
	return (
		<div class="overlay stuck-overlay">
			<div class="panel stuck-panel">
				<div class="icon">🃏</div>
				<div class="title">No more moves</div>
				<p class="sub">The game is blocked and no legal move is available.</p>
				<div class="actions">
					{canUndo && <button class="btn undo" onClick={onUndo}>Undo</button>}
					<button class="btn restart" onClick={onRestart} disabled={restarting}>{restarting ? 'Restarting…' : 'Restart deal'}</button>
					<button class="btn new" onClick={onNewGame} disabled={restarting}>New game</button>
				</div>
			</div>
		</div>
	);
}

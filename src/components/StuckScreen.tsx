interface StuckScreenProps {
	canUndo: boolean;
	onUndo: () => void;
	onNewGame: () => void;
}

export function StuckScreen({ canUndo, onUndo, onNewGame }: StuckScreenProps) {
	return (
		<div class="overlay stuck-overlay">
			<div class="panel stuck-panel">
				<div class="icon">🃏</div>
				<div class="title">No more moves</div>
				<p class="sub">The game is blocked and no legal move is available.</p>
				<div class="actions">
					{canUndo && <button class="btn undo" onClick={onUndo}>Undo</button>}
					<button class="btn new" onClick={onNewGame}>New game</button>
				</div>
			</div>
		</div>
	);
}

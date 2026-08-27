import { useEffect, useState } from 'preact/hooks';
import type { DuelResult } from '@/lib/state/duel';
import { PixelIcon } from './PixelIcon';

interface DuelResultModalProps {
	result: DuelResult;
	playerId: string;
	onRematch: () => void;
	onClose: () => void;
}

export function DuelResultModal({ result, playerId, onRematch, onClose }: DuelResultModalProps) {
	const mine = result.deltas.find((entry) => entry.playerId === playerId);
	const canRematch = !!result.roomCode;

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [onClose]);

	return (
		<div class="overlay duel-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
			<div class="panel duel-panel duel-result-panel">
				{result.cancelled ? (
					<>
						<div class="title">Partie annulée</div>
						<p class="sub">Un joueur a quitté trop tôt : aucun trophée n'a été attribué.</p>
					</>
				) : result.draw ? (
					<>
						<div class="title">Match nul</div>
						<p class="sub">Personne n'a terminé à temps : 0 trophée pour tout le monde.</p>
					</>
				) : (
					<>
						<div class="title">{mine?.playerId === playerId && mine.delta > 0 ? 'Victoire !' : 'Duel terminé'}</div>
						{mine && (
							<div class={`duel-my-delta ${mine.delta > 0 ? 'up' : mine.delta < 0 ? 'down' : ''}`}>
								{mine.delta > 0 ? '+' : ''}{mine.delta} trophées → <PixelIcon name="trophy" size={16} /> {mine.trophies}
							</div>
						)}
					</>
				)}

				{!result.cancelled && result.standings.length > 0 && (
					<ul class="duel-standings">
						{result.standings.map((entry) => {
							const delta = result.deltas.find((d) => d.playerId === entry.playerId);
							return (
								<li key={entry.playerId} class={entry.placement === 1 ? 'first' : ''}>
									<span class="duel-standing-place">{entry.finished ? (entry.placement === 1 ? <PixelIcon name="trophy" size={13} /> : `${entry.placement}e`) : '—'}</span>
									<span class="duel-standing-name">{entry.name}{entry.playerId === playerId ? ' (toi)' : ''}</span>
									{entry.trophies != null && <span class="duel-standing-trophies" title="Trophées après ce duel"><PixelIcon name="trophy" size={12} /> {entry.trophies}</span>}
									<span class="duel-standing-time">{entry.timeSeconds != null ? `${Math.floor(entry.timeSeconds / 60)}:${String(entry.timeSeconds % 60).padStart(2, '0')}` : ''}</span>
									<span class={`duel-standing-delta ${(delta?.delta ?? 0) > 0 ? 'up' : (delta?.delta ?? 0) < 0 ? 'down' : ''}`}>
										{(delta?.delta ?? 0) > 0 ? '+' : ''}{delta?.delta ?? 0}
									</span>
								</li>
							);
						})}
					</ul>
				)}

				<div class="actions">
					<button class="play-btn alt" onClick={onClose}>Fermer</button>
					{canRematch && <button class="play-btn" onClick={onRematch}>Revanche</button>}
				</div>
				{canRematch && <p class="duel-rematch-note">La revanche rassemble tous ceux qui cliquent dans un lobby d'attente : la partie redémarre quand l'hôte du nouveau lobby la lance.</p>}
			</div>
		</div>
	);
}

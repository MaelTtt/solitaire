import { useEffect, useState } from 'preact/hooks';
import { exportPlayerCode, importPlayerCode, type PlayerProfile } from '@/lib/state/player';
import { PlayerAvatar } from './PixelIcon';

interface PlayerNameModalProps {
	player: PlayerProfile;
	onSave: (name: string) => void;
	onImport: (player: PlayerProfile) => void;
	onClose: () => void;
}

export function PlayerNameModal({ player, onSave, onImport, onClose }: PlayerNameModalProps) {
	const [name, setName] = useState(player.name);
	const [code, setCode] = useState('');
	const [message, setMessage] = useState('');

	useEffect(() => setName(player.name), [player.name]);

	const copyCode = async () => {
		const playerCode = exportPlayerCode({ ...player, name });
		try {
			await navigator.clipboard.writeText(playerCode);
			setMessage('Player card copied. Paste it on another device to use the same streak and leaderboard identity.');
		} catch {
			setCode(playerCode);
			setMessage('Copy this player card code.');
		}
	};

	const importCode = () => {
		const imported = importPlayerCode(code);
		if (!imported) {
			setMessage('That player card code is not valid.');
			return;
		}
		onImport(imported);
		setMessage('Player card imported.');
	};

	return (
		<div class="overlay player-modal-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
			<div class="panel player-modal">
				<div class="title">Your player card</div>
				<p class="sub">No password: this browser keeps your private player card and uses it for streaks and scores.</p>
				<div class="player-card big">
					<span class="player-avatar"><PlayerAvatar avatar={player.avatar} size={20} /></span>
					<span class="player-id">#{player.id.slice(0, 8)}</span>
				</div>
				<input
					autoFocus
					value={name}
					maxLength={20}
					onInput={(event) => setName(event.currentTarget.value)}
					onKeyDown={(event) => {
						if (event.key === 'Enter') onSave(name);
						if (event.key === 'Escape') onClose();
					}}
				/>
				<div class="transfer-box">
					<button class="transfer-btn" onClick={copyCode}>Copy player card</button>
					<input
						value={code}
						placeholder="Paste player card code"
						onInput={(event) => setCode(event.currentTarget.value)}
					/>
					<button class="transfer-btn" onClick={importCode} disabled={!code.trim()}>Import card</button>
				</div>
				{message && <p class="transfer-message">{message}</p>}
				<div class="actions">
					<button class="play-btn alt" onClick={onClose}>Cancel</button>
					<button class="play-btn" onClick={() => onSave(name)} disabled={!name.trim()}>Save</button>
				</div>
			</div>
		</div>
	);
}

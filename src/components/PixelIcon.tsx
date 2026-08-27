import type { JSX } from 'preact';

/**
 * Icônes pixel art 24×24, extraites du projet Pixelarticons (licence MIT).
 * Copyright (c) Gerrit Halfmann — https://github.com/halfmage/pixelarticons
 * Les chemins sont inlinés pour éviter tout chargement runtime.
 */

export type PixelIconName =
	| 'trophy'
	| 'sword'
	| 'fire'
	| 'crown'
	| 'undo'
	| 'reload'
	| 'plus'
	| 'expand'
	| 'lightbulb'
	| 'close'
	| 'check'
	| 'clock'
	| 'calendar'
	| 'shuffle'
	| 'logout'
	| 'hourglass'
	| 'spade'
	| 'heart'
	| 'diamond'
	| 'club';

const PATHS: Record<PixelIconName, string> = {
	trophy:
		'M16 17H13V19H15V21H9V19H11V17H8V15H16V17ZM18 5H22V11H20V7H18V11H20V13H18V15H16V5H8V15H6V13H4V11H6V7H4V11H2V5H6V3H18V5Z',
	sword: 'M11 2h2v2h-2zM9 4h2v12H9zm4 0h2v12h-2zM7 16h10v2H7zm4 2h2v4h-2z',
	fire: 'M9 2h2v4H9zM7 6h2v2H7zM5 8h2v2H5zm8 2h2v2h-2zm2-2h2v2h-2zm2 2h2v2h-2zm2 2h2v6h-2zM3 10h2v8H3zm8-4h2v4h-2zm6 12h2v2h-2zM7 20h10v2H7zm-2-2h2v2H5zm4-2h6v4H9zM11 14h2v3h-2z',
	crown: 'M3 3h2v12H3zm16 0h2v12h-2zm-8 0h2v2h-2zM9 5h2v2H9zM5 5h2v2H5zM3 3h2v2H3zm4 4h2v2H7zm6-2h2v2h-2zm2 2h2v2h-2zm2-2h2v2h-2zM5 15h14v2H5zm-2 4h18v2H3z',
	undo: 'M18 20h-6v-2h6v2Zm2-2h-2v-8h2v8Zm-10-4H8v-2H6v-2H4V8h2V6h2V4h2v4h8v2h-8v4Z',
	reload:
		'M16 4h2v6h-2zm-2-2h2v2h-2zm0 2h2v8h-2zM4 8H2v5h2zM4 6h16v2H4zm4 14H6v-6h2zm2 2H8v-2h2zm0-2H8v-8h2zm10-4h2v-5h-2zM20 18H4v-2h16z',
	plus: 'M13 11h7v2h-7v7h-2v-7H4v-2h7V4h2v7Z',
	expand:
		'M4 13h16v-2H4zm7-8h2V3h-2zM9 7h4V5H9zm4 0h2V5h-2zm2 2h2V7h-2zM7 9h8V7H7zm4 10h2v2h-2zm-2-2h4v2H9zm4 0h2v2h-2zm2-2h2v2h-2zm-8 0h8v2H7z',
	lightbulb:
		'M9 4h6v2H9zM7 6h2v2H7zm8 0h2v2h-2zm4-2h2v2h-2zm2-2h2v2h-2zM0 10h3v2H0zm21 0h3v2h-3zM3 4h2v2H3zM1 2h2v2H1zm6 12h2v2H7zm8 0h2v2h-2zM5 8h2v6H5zm12 0h2v6h-2zm-8 8h6v2H9zm0 4h6v2H9zm0-2h2v2H9zm4 0h2v2h-2zM11 0h2v3h-2z',
	close:
		'M7 19H5V17H7V19ZM19 19H17V17H19V19ZM9 15V17H7V15H9ZM17 17H15V15H17V17ZM11 15H9V13H11V15ZM15 15H13V13H15V15ZM13 13H11V11H13V13ZM11 11H9V9H11V11ZM15 11H13V9H15V11ZM9 9H7V7H9V9ZM17 9H15V7H17V9ZM7 7H5V5H7V7ZM19 7H17V5H19V7Z',
	check:
		'M10 18H8v-2h2v2Zm-2-2H6v-2h2v2Zm4-2v2h-2v-2h2Zm-6 0H4v-2h2v2Zm8 0h-2v-2h2v2Zm2-2h-2v-2h2v2Zm2-2h-2V8h2v2Zm2-2h-2V6h2v2Z',
	clock:
		'M6 2h12v2H6zM2 6h2v12H2zm18 0h2v12h-2zm-2-2h2v2h-2zM4 4h2v2H4zm2 18h12v-2H6zm12-2h2v-2h-2zM4 20h2v-2H4zm7-14h2v7h-2zm2 7h2v2h-2zm2 2h2v2h-2z',
	calendar:
		'M5 4h14v2H5zm0 16h14v2H5zM3 10h2v10H3zm0-4h2v2H3zm16 0h2v2h-2zm0 4h2v10h-2zM3 8h18v2H3zm12-6h2v2h-2zM7 2h2v2H7z',
	shuffle:
		'M10 19H2v-2h8v2Zm12 0h-8v-2h8v2Zm-10-2h-2v-6h2v6Zm6-10h2v2h2v2h-2v2h-2v2h-2v-4h-4V9h4V5h2v2ZM8 11H2V9h6v2Z',
	logout:
		'M8 11h12v2H8zm8-2h2v2h-2zM14 7h2v10h-2zm2 6h2v2h-2zM6 2h12v2H6zm0 18h12v2H6zM4 4h2v16H4zm14 0h2v3h-2zm0 13h2v3h-2z',
	hourglass:
		'M16 22H8v-2h8v2Zm-8-2H6v-4h2v4Zm10 0h-2v-4h2v4Zm-8-4H8v-2h2v2Zm6 0h-2v-2h2v2Zm-6-6h4v4h-4v-4Zm0 0H8V8h2v2Zm6 0h-2V8h2v2ZM8 8H6V4h2v4Zm10 0h-2V4h2v4Zm-2-4H8V2h8v2Z',
	// Symboles de cartes : grilles 11×11, agrandies ×2 et centrées dans 24×24.
	spade:
		'M11 3h2v2h-2zM9 5h6v2h-6zM7 7h10v2h-10zM3 9h18v2h-18zM1 11h22v2h-22zM1 13h22v2h-22zM3 15h6v2h-6zM11 15h2v2h-2zM15 15h6v2h-6zM11 17h2v2h-2zM9 19h6v2h-6zM7 21h4v2h-4zM13 21h4v2h-4z',
	heart:
		'M5 3h4v2h-4zM15 3h4v2h-4zM3 5h8v2h-8zM13 5h8v2h-8zM1 7h22v2h-22zM1 9h22v2h-22zM1 11h22v2h-22zM3 13h18v2h-18zM5 15h14v2h-14zM7 17h10v2h-10zM9 19h6v2h-6zM11 21h2v2h-2z',
	diamond:
		'M11 1h2v2h-2zM9 3h6v2h-6zM7 5h10v2h-10zM5 7h14v2h-14zM3 9h18v2h-18zM1 11h22v2h-22zM3 13h18v2h-18zM5 15h14v2h-14zM7 17h10v2h-10zM9 19h6v2h-6zM11 21h2v2h-2z',
	club:
		'M9 1h6v2h-6zM7 3h10v2h-10zM7 5h10v2h-10zM3 7h4v2h-4zM9 7h6v2h-6zM17 7h4v2h-4zM1 9h8v2h-8zM11 9h2v2h-2zM15 9h8v2h-8zM1 11h22v2h-22zM1 13h8v2h-8zM11 13h2v2h-2zM15 13h8v2h-8zM3 15h4v2h-4zM11 15h2v2h-2zM17 15h4v2h-4zM11 17h2v2h-2zM9 19h6v2h-6zM7 21h4v2h-4zM13 21h4v2h-4z'
};

interface PixelIconProps {
	name: PixelIconName;
	size?: number;
	class?: string;
	style?: string | JSX.CSSProperties;
	title?: string;
}

/**
 * Rendu net du pixel art : chaque « pixel » du SVG doit occuper un nombre
 * entier de pixels physiques. Avec viewBox 24 et un écran à densité dpr,
 * une largeur de `24 × m / dpr` px CSS donne exactement m pixels physiques
 * par pixel du dessin (m entier ≥ 1). On choisit donc la taille exacte la
 * plus proche de la taille demandée ; sinon on rend lisse (léger flou
 * uniforme) plutôt qu'irrégulier.
 */
function snapSize(size: number): { size: number; crisp: boolean } {
	const dpr = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
	const isExact = (css: number) => {
		const device = css * dpr;
		return device >= 24 && Math.abs(device - Math.round(device / 24) * 24) < 0.01;
	};
	if (isExact(size)) return { size, crisp: true };

	const candidates: number[] = [];
	for (let m = 1; m <= 6; m++) candidates.push((24 * m) / dpr);
	// candidats exacts proches de la taille demandée (tolérance 4 px)
	let best: number | null = null;
	for (const candidate of candidates) {
		if (Math.abs(candidate - size) <= 4 && (best === null || Math.abs(candidate - size) < Math.abs(best - size))) {
			best = candidate;
		}
	}
	if (best !== null) return { size: best, crisp: true };
	return { size, crisp: false };
}

export function PixelIcon({ name, size = 16, class: className, style, title }: PixelIconProps) {
	const snapped = snapSize(size);
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={snapped.size}
			height={snapped.size}
			viewBox="0 0 24 24"
			fill="currentColor"
			shape-rendering={snapped.crisp ? 'crispEdges' : 'auto'}
			class={className ? `pixel-icon ${className}` : 'pixel-icon'}
			style={style}
			aria-hidden={title ? undefined : 'true'}
			role={title ? 'img' : undefined}
		>
			{title && <title>{title}</title>}
			<path d={PATHS[name]} />
		</svg>
	);
}

/** Avatar joueur : symbole de carte ou icône pixel art (préfixe "pixel:"), sinon texte. */
const SUIT_AVATARS: Record<string, PixelIconName> = {
	'♠': 'spade',
	'♥': 'heart',
	'♦': 'diamond',
	'♣': 'club'
};

export function PlayerAvatar({ avatar, size = 16, class: className }: { avatar: string; size?: number; class?: string }) {
	if (avatar.startsWith('pixel:')) {
		const name = avatar.slice(6) as PixelIconName;
		if (name in PATHS) {
			return <PixelIcon name={name} size={size} class={className ? `player-avatar-icon ${className}` : 'player-avatar-icon'} />;
		}
	}
	const suitIcon = SUIT_AVATARS[avatar];
	if (suitIcon) {
		return <PixelIcon name={suitIcon} size={size} class={className ? `player-avatar-icon ${className}` : 'player-avatar-icon'} />;
	}
	return <span class={className}>{avatar}</span>;
}

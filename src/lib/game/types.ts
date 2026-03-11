export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;
export type Color = 'red' | 'black';

export interface Card {
	id: string; // e.g. "spades-1"
	suit: Suit;
	rank: Rank;
	faceUp: boolean;
}

export type GameMode = 'daily' | 'random';

export interface GameState {
	stock: Card[];
	waste: Card[];
	foundations: [Card[], Card[], Card[], Card[]];
	tableau: [Card[], Card[], Card[], Card[], Card[], Card[], Card[]];
	score: number;
	drawMode: 1 | 3;
	moves: number;
	startTime: number;
	endTime: number | null;
	hintsUsed: number;
	recycleCount: number;
	mode: GameMode;
	seed: string;
}

export type PileType = 'stock' | 'waste' | 'foundation' | 'tableau';

export interface PileLocation {
	type: PileType;
	index: number; // foundation 0-3, tableau 0-6, waste/stock = 0
}

export interface DragPayload {
	cards: Card[];
	from: PileLocation;
	originX: number;
	originY: number;
}

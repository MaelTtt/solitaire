export const SCORE_FOUNDATION = 10;
export const SCORE_FLIP = 5;
export const SCORE_TABLEAU = 5;
export const SCORE_RECYCLE = -15;
export const SCORE_WASTE_TO_TABLEAU = 5;
export const SCORE_UNDO = -2;

export function timeBonus(elapsedSeconds: number, score: number): number {
	if (elapsedSeconds <= 0) return 0;
	return Math.max(0, Math.round((700000 / elapsedSeconds) - score));
}

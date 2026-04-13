import { json } from '@sveltejs/kit';
import { todaySeed } from '$lib/game/seedRng';
import { findSolvableSeed } from '$lib/game/solver';

// In-memory cache: date string → proven solvable attempt seed
const cache = new Map<string, string>();

export function GET() {
	const date = todaySeed(); // YYYY-MM-DD in UTC

	if (!cache.has(date)) {
		cache.clear();
		cache.set(date, findSolvableSeed(date, 1, 50));
	}

	return json({ seed: cache.get(date) });
}

import { describe, expect, test } from 'bun:test';
import { advanceDailyAttempt, type LocalAttempt } from './leaderboard';

describe('daily attempt accounting', () => {
	test('starts a new daily attempt without counting a restart', () => {
		const current: LocalAttempt = {
			seed: '',
			started: false,
			completed: false,
			restarts: 0
		};

		expect(advanceDailyAttempt(current, 'certified-v2:today')).toEqual({
			attempt: {
				seed: 'certified-v2:today',
				started: true,
				completed: false,
				restarts: 0
			},
			isRestart: false
		});
	});

	test('increments exactly once for each started daily attempt', () => {
		const current: LocalAttempt = {
			seed: 'certified-v2:today',
			started: true,
			completed: false,
			restarts: 2
		};

		const next = advanceDailyAttempt(current, current.seed);

		expect(next.attempt.restarts).toBe(3);
		expect(next.isRestart).toBe(true);
		expect(current.restarts).toBe(2);
	});

	test('does not count a server-side daily seed migration as a restart', () => {
		const current: LocalAttempt = {
			seed: 'certified-v2:today',
			started: true,
			completed: false,
			restarts: 0
		};

		const next = advanceDailyAttempt(current, 'verified-v3:today#3');

		expect(next.isRestart).toBe(false);
		expect(next.attempt.restarts).toBe(0);
		expect(next.attempt.seed).toBe('verified-v3:today#3');
	});
});

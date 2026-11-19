import { describe, expect, it } from 'vitest';
import { formatDuration, screenTilt, shelfSummary, statusOf } from './shelf.ts';

describe('formatDuration', () => {
	it('prints minutes and zero-padded seconds', () => {
		expect(formatDuration(745)).toBe('12:25');
		expect(formatDuration(65)).toBe('1:05');
		expect(formatDuration(9)).toBe('0:09');
	});

	it('adds hours past 60 minutes', () => {
		expect(formatDuration(3723)).toBe('1:02:03');
		expect(formatDuration(36000)).toBe('10:00:00');
	});

	it('rounds fractions down and says nothing for unknown or bad values', () => {
		expect(formatDuration(59.9)).toBe('0:59');
		expect(formatDuration(undefined)).toBeUndefined();
		expect(formatDuration(0)).toBeUndefined();
		expect(formatDuration(-5)).toBeUndefined();
		expect(formatDuration(Number.NaN)).toBeUndefined();
		expect(formatDuration(Number.POSITIVE_INFINITY)).toBeUndefined();
	});
});

describe('statusOf', () => {
	it('labels what is known', () => {
		expect(statusOf('alive')).toEqual({ label: 'Ativo', tone: 'ok' });
		expect(statusOf('dead')).toEqual({ label: 'Fora do ar', tone: 'dead' });
		expect(statusOf('restricted')).toEqual({ label: 'Restrito', tone: 'dead' });
	});

	it('shows nothing when the link was never checked', () => {
		expect(statusOf('unknown')).toBeUndefined();
	});
});

describe('shelfSummary', () => {
	const v = (health: 'alive' | 'dead' | 'restricted' | 'unknown') => ({ health });

	it('counts videos', () => {
		expect(shelfSummary([])).toBe('0 vídeos');
		expect(shelfSummary([v('alive')])).toBe('1 vídeo');
		expect(shelfSummary([v('alive'), v('unknown')])).toBe('2 vídeos');
	});

	it('adds how many are out of the air, and only those', () => {
		expect(shelfSummary([v('alive'), v('dead')])).toBe('2 vídeos · 1 fora do ar');
		expect(shelfSummary([v('dead'), v('dead'), v('alive')])).toBe('3 vídeos · 2 fora do ar');
		// Restricted is its own state; it is not counted as dead.
		expect(shelfSummary([v('restricted'), v('alive')])).toBe('2 vídeos');
	});
});

describe('screenTilt', () => {
	it('alternates sides so neighbours lean opposite ways', () => {
		const t = Array.from({ length: 6 }, (_, i) => screenTilt(i));
		for (let i = 1; i < t.length; i++) {
			expect(Math.sign(t[i].rotZ)).not.toBe(Math.sign(t[i - 1].rotZ));
			expect(Math.sign(t[i].rotY)).not.toBe(Math.sign(t[i - 1].rotY));
		}
	});

	it('stays small enough to read the title (bounded angles) and is never flat', () => {
		for (let i = 0; i < 40; i++) {
			const { rotZ, rotY, shiftX } = screenTilt(i);
			expect(Math.abs(rotZ)).toBeGreaterThan(0.5);
			expect(Math.abs(rotZ)).toBeLessThanOrEqual(3);
			expect(Math.abs(rotY)).toBeLessThanOrEqual(8);
			expect(Math.abs(shiftX)).toBeLessThanOrEqual(6);
		}
	});

	it('is deterministic: the same index always gives the same pose', () => {
		expect(screenTilt(7)).toEqual(screenTilt(7));
	});

	it('does not repeat the same pose for the first few neighbours', () => {
		const poses = new Set(Array.from({ length: 4 }, (_, i) => JSON.stringify(screenTilt(i))));
		expect(poses.size).toBe(4);
	});
});

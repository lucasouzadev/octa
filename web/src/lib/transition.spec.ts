import { describe, expect, it } from 'vitest';
import { transitionMode } from './transition.ts';

describe('transitionMode', () => {
	it('is "none" when the browser has no View Transitions', () => {
		expect(transitionMode({ supported: false, reducedMotion: false })).toBe('none');
	});

	it('is "none" when unsupported even with reduced motion', () => {
		expect(transitionMode({ supported: false, reducedMotion: true })).toBe('none');
	});

	it('is a short fade, never a morph, with reduced motion', () => {
		expect(transitionMode({ supported: true, reducedMotion: true })).toBe('fade');
	});

	it('is the full card-to-player transition otherwise', () => {
		expect(transitionMode({ supported: true, reducedMotion: false })).toBe('full');
	});
});

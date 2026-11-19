import { describe, expect, it } from 'vitest';
import { dragOffset, shouldDismiss } from './sheet.ts';

// Gesture rules for every bottom sheet (QA round 1, item 3). Rendering lives in Sheet.svelte.
describe('dragOffset', () => {
	it('follows the finger one to one when pulling down', () => {
		expect(dragOffset(0)).toBe(0);
		expect(dragOffset(37)).toBe(37);
		expect(dragOffset(400)).toBe(400);
	});

	it('resists when pulling up and never goes past a small stretch', () => {
		const a = dragOffset(-20);
		const b = dragOffset(-200);
		const c = dragOffset(-5000);
		expect(a).toBeLessThan(0);
		expect(Math.abs(a)).toBeLessThan(20);
		expect(Math.abs(b)).toBeGreaterThan(Math.abs(a));
		expect(Math.abs(c)).toBeLessThanOrEqual(56);
	});
});

describe('shouldDismiss', () => {
	const height = 400;

	it('closes when dragged past a third of the sheet', () => {
		expect(shouldDismiss(150, height, 0)).toBe(true);
		expect(shouldDismiss(100, height, 0)).toBe(false);
	});

	it('closes on a quick downward flick even for a short drag', () => {
		expect(shouldDismiss(40, height, 0.8)).toBe(true);
		expect(shouldDismiss(10, height, 0.8)).toBe(false); // a twitch is not a flick
	});

	it('never closes from an upward pull, however fast', () => {
		expect(shouldDismiss(-80, height, -2)).toBe(false);
		expect(shouldDismiss(0, height, 0)).toBe(false);
	});
});

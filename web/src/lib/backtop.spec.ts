import { describe, expect, it } from 'vitest';
import { BACK_TO_TOP_AFTER, showBackToTop } from './backtop.ts';

describe('showBackToTop', () => {
	it('stays hidden near the top and on short pages', () => {
		expect(showBackToTop(0, 800)).toBe(false);
		expect(showBackToTop(300, 800)).toBe(false);
	});

	it('shows once the reader is more than ~1.2 screens down', () => {
		expect(BACK_TO_TOP_AFTER).toBe(1.2);
		expect(showBackToTop(960, 800)).toBe(false); // exactly 1.2 screens
		expect(showBackToTop(961, 800)).toBe(true);
		expect(showBackToTop(5000, 800)).toBe(true);
	});

	it('scales with the viewport, so a tall tablet needs a longer scroll', () => {
		expect(showBackToTop(1200, 800)).toBe(true);
		expect(showBackToTop(1200, 1100)).toBe(false);
	});

	it('is safe with a zero or negative viewport', () => {
		expect(showBackToTop(100, 0)).toBe(true);
		expect(showBackToTop(-20, 800)).toBe(false);
	});
});

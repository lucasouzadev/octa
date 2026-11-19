import { describe, expect, it } from 'vitest';
import { heartBurst } from './hearts.ts';

// The hearts that float up from the Curtir button (QA round 1, item 4).
describe('heartBurst', () => {
	it('makes the asked number of hearts, 9 by default', () => {
		expect(heartBurst()).toHaveLength(9);
		expect(heartBurst(4, 7)).toHaveLength(4);
		expect(heartBurst(0)).toEqual([]);
	});

	it('keeps every heart inside sane bounds so none leaves the screen or lingers', () => {
		for (let seed = 1; seed <= 30; seed++) {
			for (const h of heartBurst(12, seed)) {
				expect(Math.abs(h.dx)).toBeLessThanOrEqual(64);
				expect(h.delay).toBeGreaterThanOrEqual(0);
				expect(h.delay).toBeLessThanOrEqual(320);
				expect(h.size).toBeGreaterThanOrEqual(14);
				expect(h.size).toBeLessThanOrEqual(30);
				expect(h.duration).toBeGreaterThanOrEqual(900);
				expect(h.duration).toBeLessThanOrEqual(1500);
				expect(Math.abs(h.rotate)).toBeLessThanOrEqual(28);
			}
		}
	});

	it('is deterministic per seed and different across seeds', () => {
		expect(heartBurst(9, 3)).toEqual(heartBurst(9, 3));
		expect(heartBurst(9, 3)).not.toEqual(heartBurst(9, 4));
	});

	it('spreads left and right of the button, not one side only', () => {
		const dx = heartBurst(9, 5).map((h) => h.dx);
		expect(dx.some((x) => x < 0)).toBe(true);
		expect(dx.some((x) => x > 0)).toBe(true);
	});
});

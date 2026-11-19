import { describe, expect, it } from 'vitest';
import { keyboardInset } from './keyboard.ts';

// How much of the layout viewport the on-screen keyboard covers, so a bar can sit right
// above it without moving the page (QA round 1, items 1 and 2). Same numbers work in
// Safari, an installed PWA and (via the Keyboard plugin) Capacitor.
describe('keyboardInset', () => {
	it('is 0 when nothing covers the page', () => {
		expect(keyboardInset({ height: 844, offsetTop: 0 }, 844)).toBe(0);
	});

	it('is the height the keyboard takes from the bottom', () => {
		expect(keyboardInset({ height: 520, offsetTop: 0 }, 844)).toBe(324);
	});

	it('does not count the part the visual viewport scrolled away from the top', () => {
		// iOS slides the visual viewport down when it reveals a field: the keyboard is still
		// 324px; what changed is where the visible window starts.
		expect(keyboardInset({ height: 520, offsetTop: 120 }, 844)).toBe(204);
	});

	it('never goes negative, even while the browser bars animate', () => {
		expect(keyboardInset({ height: 900, offsetTop: 0 }, 844)).toBe(0);
		expect(keyboardInset({ height: 700, offsetTop: 300 }, 844)).toBe(0);
	});

	it('is a whole number of pixels', () => {
		expect(Number.isInteger(keyboardInset({ height: 520.4, offsetTop: 0.3 }, 844))).toBe(true);
	});
});

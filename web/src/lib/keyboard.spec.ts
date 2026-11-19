import { describe, expect, it } from 'vitest';
import { keyboardInset, visualFrame } from './keyboard.ts';

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

// QA round 2, item 3: on a real iPhone the bar was drawn below the keyboard because the
// offset of the visual viewport was applied twice. The frame below is the one place that
// converts the visual viewport into layout coordinates; the bar and the dim use it as is.
describe('visualFrame', () => {
	it('is the whole window when nothing is open', () => {
		expect(visualFrame({ height: 844, width: 390, offsetTop: 0, offsetLeft: 0 })).toEqual({
			top: 0,
			left: 0,
			width: 390,
			height: 844,
			bottom: 844
		});
	});

	it('follows the visible window when iOS pans it above the keyboard', () => {
		const f = visualFrame({ height: 520, width: 390, offsetTop: 120, offsetLeft: 0 });
		expect(f.top).toBe(120);
		expect(f.bottom).toBe(640); // the bar's bottom edge: right where the keyboard starts
	});

	it('rounds fractions so the bar never sits on a half pixel', () => {
		const f = visualFrame({ height: 519.6, width: 390.4, offsetTop: 0.4, offsetLeft: 0.2 });
		expect(f).toEqual({ top: 0, left: 0, width: 390, height: 520, bottom: 520 });
	});
});

import { describe, expect, it } from 'vitest';
import { isLightColor, themeColorFor } from './screen.ts';

// The browser chrome (status bar, bottom bar) takes the color of the screen so the
// page feels endless. Blue action screens used to show white strips top and bottom.
describe('themeColorFor', () => {
	it('is the action blue on the two create screens', () => {
		expect(themeColorFor('/add')).toBe('#1A3CFF');
		expect(themeColorFor('/c/new')).toBe('#1A3CFF');
	});

	it('is white on the Library', () => {
		expect(themeColorFor('/')).toBe('#FFFFFF');
	});

	it('is black on collection and player', () => {
		expect(themeColorFor('/c/[id]')).toBe('#000000');
		expect(themeColorFor('/v/[id]')).toBe('#000000');
	});

	it('is the matte green on the Favoritos collection only', () => {
		expect(themeColorFor('/c/[id]', 'favoritos')).toBe('#2F6B4F');
		expect(themeColorFor('/c/[id]', 'todos')).toBe('#000000');
		expect(themeColorFor('/c/[id]', 'assistidos')).toBe('#000000');
		expect(themeColorFor('/c/[id]', 'uma-colecao')).toBe('#000000');
		expect(themeColorFor('/', 'favoritos')).toBe('#FFFFFF');
	});

	it('falls back to black for unknown or missing routes', () => {
		expect(themeColorFor(null)).toBe('#000000');
		expect(themeColorFor('/qualquer')).toBe('#000000');
	});
});

describe('isLightColor (R4.6)', () => {
	it('is true for the white Library and false for the dark, blue and green screens', () => {
		expect(isLightColor('#FFFFFF')).toBe(true);
		expect(isLightColor('#ffffff')).toBe(true);
		for (const c of ['#000000', '#1A3CFF', '#2F6B4F']) expect(isLightColor(c)).toBe(false);
	});

	it('follows every screen the app has', () => {
		expect(isLightColor(themeColorFor('/'))).toBe(true);
		expect(isLightColor(themeColorFor('/add'))).toBe(false);
		expect(isLightColor(themeColorFor('/v/[id]'))).toBe(false);
		expect(isLightColor(themeColorFor('/c/[id]', 'favoritos'))).toBe(false);
	});

	it('treats anything it cannot read as dark', () => {
		expect(isLightColor('red')).toBe(false);
	});
});

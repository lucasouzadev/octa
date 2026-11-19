import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// QA round 1: buttons were #161616 on black and #F2F2F2 on white, so they vanished
// unless the screen brightness was raised. These ratios pin the fix.
const css = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8');
const hex = (name: string) => {
	const m = css.match(new RegExp(`--color-${name}: (#[0-9A-Fa-f]{6});`));
	if (!m) throw new Error(`missing token ${name}`);
	return m[1];
};

function luminance(color: string) {
	const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255).map((c) =>
		c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
	);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string) {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

describe('surfaces are visible without raising the screen brightness', () => {
	it('dark surface stands out from the black page', () => {
		expect(ratio(hex('surface-dark'), hex('bg-dark'))).toBeGreaterThanOrEqual(1.5);
	});

	it('raised dark surface (buttons on a sheet or row) stands out from the dark surface', () => {
		expect(ratio(hex('surface-dark-raised'), hex('surface-dark'))).toBeGreaterThanOrEqual(1.2);
	});

	it('light cards and round buttons stand out from the white page', () => {
		expect(ratio(hex('surface-light'), hex('bg-light'))).toBeGreaterThanOrEqual(1.15);
		expect(ratio(hex('surface-light-button'), hex('bg-light'))).toBeGreaterThanOrEqual(1.25);
	});

	it('text stays readable on every surface (WCAG AA, 4.5:1)', () => {
		expect(ratio(hex('text-dark'), hex('surface-dark-raised'))).toBeGreaterThanOrEqual(4.5);
		expect(ratio(hex('muted-on-dark'), hex('surface-dark'))).toBeGreaterThanOrEqual(4.5);
		expect(ratio(hex('text-light'), hex('surface-light-button'))).toBeGreaterThanOrEqual(4.5);
		expect(ratio(hex('muted-on-light'), hex('surface-light'))).toBeGreaterThanOrEqual(4.5);
	});
});

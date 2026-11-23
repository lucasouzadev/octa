import { describe, expect, it } from 'vitest';
import { platformOf } from './platform.ts';

describe('platformOf (R7.3b)', () => {
	it('names one theme per platform, shorts and reels apart from their parents', () => {
		expect(platformOf({ source: 'youtube', kind: 'video' }).key).toBe('youtube');
		expect(platformOf({ source: 'youtube', kind: 'short' }).key).toBe('shorts');
		expect(platformOf({ source: 'tiktok', kind: 'short' }).key).toBe('tiktok');
		expect(platformOf({ source: 'instagram', kind: 'reel' }).key).toBe('reels');
		expect(platformOf({ source: 'instagram', kind: 'video' }).key).toBe('instagram');
		expect(platformOf({ source: 'direct', kind: 'video' }).key).toBe('file');
		expect(platformOf({ source: 'direct', kind: 'hls' }).key).toBe('file');
	});

	it('gives each a colour and an icon, and every colour is readable on black (4.5:1)', () => {
		const lum = (hex: string) => {
			const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
			return 0.2126 * r + 0.7152 * g + 0.0722 * b;
		};
		for (const [source, kind] of [['youtube', 'video'], ['youtube', 'short'], ['tiktok', 'short'], ['instagram', 'reel'], ['direct', 'video']] as const) {
			const p = platformOf({ source, kind });
			expect(p.icon).toBeTruthy();
			expect((lum(p.color) + 0.05) / 0.05).toBeGreaterThanOrEqual(4.5);
		}
	});
});

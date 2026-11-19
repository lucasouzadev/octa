import { describe, expect, it } from 'vitest';
import { cardLabel, fanCards, fanLayout, MAX_FAN } from './fan.ts';

describe('fanLayout', () => {
	it('is empty for no cards and never more than MAX_FAN', () => {
		expect(fanLayout(0)).toEqual([]);
		expect(fanLayout(12)).toHaveLength(MAX_FAN);
		expect(MAX_FAN).toBe(5);
	});

	it('puts a single card straight and centered', () => {
		const [only] = fanLayout(1);
		expect(only.x).toBe(0);
		expect(only.rotZ).toBe(0);
	});

	it('is mirror-symmetric around the middle card for every count', () => {
		for (let n = 2; n <= MAX_FAN; n++) {
			const cards = fanLayout(n);
			cards.forEach((c, i) => {
				const mirror = cards[n - 1 - i];
				expect(c.x).toBeCloseTo(-mirror.x, 6);
				expect(c.rotZ).toBeCloseTo(-mirror.rotZ, 6);
				expect(c.drop).toBeCloseTo(mirror.drop, 6);
			});
		}
	});

	it('keeps the middle card on top and lets the outer ones fall behind', () => {
		for (let n = 3; n <= MAX_FAN; n++) {
			const cards = fanLayout(n);
			const top = Math.max(...cards.map((c) => c.z));
			const middle = cards[Math.floor((n - 1) / 2)];
			expect(top).toBe(middle.z);
			expect(cards[0].z).toBeLessThan(top);
			expect(cards[n - 1].z).toBeLessThan(top);
			// z is a strict stacking order: no two cards share a layer.
			expect(new Set(cards.map((c) => c.z)).size).toBe(n);
		}
	});

	it('spreads left to right and tips outward more as the fan grows', () => {
		const four = fanLayout(4);
		const five = fanLayout(5);
		expect(four[0].x).toBeLessThan(four[3].x);
		expect(five[0].x).toBeLessThan(five[4].x);
		expect(Math.abs(five[0].rotZ)).toBeGreaterThan(Math.abs(four[0].rotZ));
	});

	it('keeps every card inside the container', () => {
		for (let n = 1; n <= MAX_FAN; n++) {
			for (const c of fanLayout(n)) expect(Math.abs(c.x)).toBeLessThanOrEqual(36);
		}
	});
});

describe('cardLabel', () => {
	const v = (source: 'youtube' | 'direct', kind: 'video' | 'short' | 'direct') => ({ source, kind });

	it('names the source like the prototype (uppercase is the renderer\'s job)', () => {
		expect(cardLabel(v('youtube', 'video'))).toBe('YouTube');
		expect(cardLabel(v('youtube', 'short'))).toBe('Shorts');
		expect(cardLabel(v('direct', 'direct'))).toBe('MP4');
	});
});

describe('fanCards', () => {
	const item = (id: string, aspect = '16:9') => ({
		id,
		thumbnail: `https://t/${id}.jpg`,
		source: 'youtube' as const,
		kind: 'video' as const,
		embed: { aspect }
	});

	it('puts the newest video on top and older ones behind it', () => {
		const cards = fanCards([item('a'), item('b'), item('c')]);
		const byZ = [...cards].sort((x, y) => y.z - x.z).map((c) => c.item?.id);
		expect(byZ).toEqual(['a', 'b', 'c']);
	});

	it('uses at most MAX_FAN videos', () => {
		const many = Array.from({ length: 9 }, (_, i) => item(String(i)));
		expect(fanCards(many)).toHaveLength(MAX_FAN);
	});

	it('shows three empty placeholders for an empty collection', () => {
		const cards = fanCards([]);
		expect(cards).toHaveLength(3);
		expect(cards.every((c) => c.item === null)).toBe(true);
	});

	it('marks 9:16 videos as vertical cards and the rest as landscape', () => {
		const cards = fanCards([item('a', '9:16'), item('b', '16:9')]);
		const a = cards.find((c) => c.item?.id === 'a')!;
		const b = cards.find((c) => c.item?.id === 'b')!;
		expect(a.vertical).toBe(true);
		expect(b.vertical).toBe(false);
	});
});

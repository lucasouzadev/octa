import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadMode, moveBy, moveTo, saveMode, slotAt, sortCollections, type Ranked } from '#lib/organize.ts';

const c = (id: string, name: string, createdAt: string, count = 0, rank?: number, updatedAt = createdAt): Ranked => ({
	id,
	name,
	createdAt,
	updatedAt,
	order: Array.from({ length: count }, (_, i) => `${id}${i}`),
	rank
});

const A = c('a', 'Aulas', '2026-11-01T00:00:00Z', 2);
const B = c('b', 'Ágata', '2026-11-02T00:00:00Z', 5);
const C = c('c', 'zebra', '2026-11-03T00:00:00Z', 1);
const ids = (l: Ranked[]) => l.map((x) => x.id);

describe('sortCollections', () => {
	it('manual with no ranks keeps the oldest first (what the Library did before)', () => {
		expect(ids(sortCollections([C, A, B], 'manual'))).toEqual(['a', 'b', 'c']);
	});
	it('manual follows the saved ranks; unranked ones come last, oldest first', () => {
		const ranked = [{ ...A, rank: 2 }, { ...B, rank: 0 }, { ...C }];
		expect(ids(sortCollections(ranked, 'manual'))).toEqual(['b', 'a', 'c']);
	});
	it('A–Z ignores accents and case', () => {
		expect(ids(sortCollections([C, B, A], 'az'))).toEqual(['b', 'a', 'c']);
	});
	it('recent puts the latest change first', () => {
		const l = [A, { ...B, updatedAt: '2026-11-19T00:00:00Z' }, C];
		expect(ids(sortCollections(l, 'recent'))).toEqual(['b', 'c', 'a']);
	});
	it('count puts the biggest first, ties oldest first', () => {
		expect(ids(sortCollections([A, C, B], 'count'))).toEqual(['b', 'a', 'c']);
	});
	it('does not mutate its input', () => {
		const input = [C, A, B];
		sortCollections(input, 'az');
		expect(ids(input)).toEqual(['c', 'a', 'b']);
	});
});

describe('moveTo / moveBy', () => {
	it('moves an item to a new index', () => {
		expect(moveTo(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
		expect(moveTo(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
	});
	it('clamps and returns a copy when nothing changes', () => {
		const l = ['a', 'b'];
		expect(moveTo(l, 0, 9)).toEqual(['b', 'a']);
		expect(moveTo(l, 0, 0)).toEqual(['a', 'b']);
		expect(moveTo(l, 0, 0)).not.toBe(l);
	});
	it('moveBy steps one place and stops at the ends', () => {
		expect(moveBy(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
		expect(moveBy(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c']);
		expect(moveBy(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c']);
		expect(moveBy(['a', 'b', 'c'], 'zz', 1)).toEqual(['a', 'b', 'c']);
	});
});

describe('slotAt', () => {
	const tops = [100, 180, 260, 340]; // four rows, 80 tall
	it('finds the row under the pointer', () => {
		expect(slotAt(105, tops, 80)).toBe(0);
		expect(slotAt(215, tops, 80)).toBe(1);
		expect(slotAt(339, tops, 80)).toBe(2);
	});
	it('clamps above the first and below the last', () => {
		expect(slotAt(-50, tops, 80)).toBe(0);
		expect(slotAt(9999, tops, 80)).toBe(3);
	});
});

describe('sortVideos (R4.5)', () => {
	const v = (id: string, title: string, source: 'youtube' | 'tiktok' | 'instagram' | 'direct', createdAt: string) => ({
		id,
		title,
		source,
		kind: 'video' as const,
		createdAt
	});
	const list = [
		v('1', 'beta', 'tiktok', '2026-11-01T10:00:00Z'),
		v('2', 'Álbum', 'youtube', '2026-11-03T10:00:00Z'),
		v('3', 'cedro', 'youtube', '2026-11-02T10:00:00Z'),
		v('4', 'Alfa', 'direct', '2026-11-04T10:00:00Z')
	];

	it('date: newest first, like the Library', async () => {
		const { sortVideos } = await import('#lib/organize.ts');
		expect(sortVideos(list, 'date').map((x) => x.id)).toEqual(['4', '2', '3', '1']);
	});

	it('title: A to Z, accents and case aside', async () => {
		const { sortVideos } = await import('#lib/organize.ts');
		expect(sortVideos(list, 'title').map((x) => x.id)).toEqual(['2', '4', '1', '3']);
	});

	it('source: grouped by platform name, newest first inside a group', async () => {
		const { sortVideos } = await import('#lib/organize.ts');
		expect(sortVideos(list, 'source').map((x) => x.id)).toEqual(['4', '1', '2', '3']);
	});

	it('does not change the list it was given', async () => {
		const { sortVideos } = await import('#lib/organize.ts');
		const before = list.map((x) => x.id);
		sortVideos(list, 'title');
		expect(list.map((x) => x.id)).toEqual(before);
	});
});

// R5.2: the way to sort is remembered per screen, so the Library and a collection do not share one choice.
describe('loadMode / saveMode per screen (R5.2)', () => {
	const store = new Map<string, string>();
	const fake = {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => void store.set(k, v),
		removeItem: (k: string) => void store.delete(k)
	};
	beforeEach(() => {
		store.clear();
		vi.stubGlobal('localStorage', fake);
	});
	afterEach(() => vi.unstubAllGlobals());

	it('starts on the manual order for every screen', () => {
		expect(loadMode('home')).toBe('manual');
		expect(loadMode('move')).toBe('manual');
	});

	it('keeps one choice per screen', () => {
		saveMode('az', 'home');
		saveMode('count', 'move');
		expect(loadMode('home')).toBe('az');
		expect(loadMode('move')).toBe('count');
	});

	it('the Library still reads the single choice saved before screens had their own', () => {
		store.set('octa.sort', 'recent');
		expect(loadMode('home')).toBe('recent');
		expect(loadMode()).toBe('recent');
	});

	it('ignores a stored value that is not a mode', () => {
		store.set('octa.sort.home', 'nonsense');
		expect(loadMode('home')).toBe('manual');
	});
});

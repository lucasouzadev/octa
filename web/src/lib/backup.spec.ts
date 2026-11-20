import { describe, expect, it } from 'vitest';
import { BACKUP_SCHEMA, buildBackup, parseBackup, planImport, type Backup } from '#lib/backup.ts';
import type { Collection, Video } from '#lib/db/library.ts';
import { parseLink } from '#lib/providers/parse.ts';

const NOW = '2026-11-20T12:00:00.000Z';

function video(n: number, over: Partial<Video> = {}): Video {
	const ref = parseLink(`https://youtu.be/dQw4w9WgX${String(n).padStart(2, '0')}`);
	return {
		id: `v${n}`,
		url: `https://youtu.be/dQw4w9WgX${String(n).padStart(2, '0')}`,
		canonicalUrl: ref.canonicalUrl,
		source: ref.source,
		kind: ref.kind,
		embed: ref.embed,
		title: `Video ${n}`,
		health: 'alive',
		deadStreak: 0,
		favorite: false,
		createdAt: `2026-11-0${n}T00:00:00.000Z`,
		updatedAt: `2026-11-0${n}T00:00:00.000Z`,
		...over
	};
}

const col = (id: string, name: string, order: string[], rank?: number): Collection => ({
	id,
	name,
	order,
	createdAt: '2026-11-01T00:00:00.000Z',
	updatedAt: '2026-11-01T00:00:00.000Z',
	rank
});

describe('buildBackup / parseBackup', () => {
	it('round-trips with zero loss, including rank, favorite, watched and position', () => {
		const videos = [video(1, { favorite: true, watched: true, positionSec: 42, author: 'A', durationSec: 10 }), video(2)];
		const collections = [col('c1', 'Aulas', ['v1']), col('c2', 'Música', ['v2'], 0)];
		const text = JSON.stringify(buildBackup(videos, collections, NOW));
		const parsed = parseBackup(text);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.backup.schema).toBe(BACKUP_SCHEMA);
		expect(parsed.backup.videos).toEqual(videos);
		expect(parsed.backup.collections).toEqual(collections);
	});

	it('rejects what is not an octa file', () => {
		expect(parseBackup('nope')).toEqual({ ok: false, error: 'not_json' });
		expect(parseBackup('[]')).toEqual({ ok: false, error: 'not_octa' });
		expect(parseBackup(JSON.stringify({ app: 'other', schema: 1, videos: [], collections: [] }))).toEqual({ ok: false, error: 'not_octa' });
	});

	it('refuses a newer schema instead of guessing', () => {
		const b = { ...buildBackup([], [], NOW), schema: BACKUP_SCHEMA + 1 };
		expect(parseBackup(JSON.stringify(b))).toEqual({ ok: false, error: 'newer_schema' });
	});

	it('refuses a file that is too big', () => {
		expect(parseBackup(' '.repeat(11 * 1024 * 1024))).toEqual({ ok: false, error: 'too_big' });
	});

	it('never trusts the embed in the file: it is rebuilt from the link', () => {
		const evil = { ...video(1), embed: { type: 'iframe', src: 'https://evil.example/x', aspect: '16:9' } };
		const parsed = parseBackup(JSON.stringify({ ...buildBackup([], [], NOW), videos: [evil] }));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.backup.videos[0].embed.src).toContain('youtube-nocookie.com');
	});

	it('drops videos whose link is not a supported one, and counts them', () => {
		const bad = [video(1), { ...video(2), canonicalUrl: 'javascript:alert(1)', url: 'javascript:alert(1)' }, { ...video(3), url: 5, canonicalUrl: 5 }];
		const parsed = parseBackup(JSON.stringify({ ...buildBackup([], [], NOW), videos: bad }));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.backup.videos.map((v) => v.id)).toEqual(['v1']);
		expect(parsed.dropped).toBe(2);
	});

	it('drops a thumbnail that is not https, and limits text lengths', () => {
		const v = { ...video(1), thumbnail: 'javascript:alert(1)', title: 'x'.repeat(5000) };
		const parsed = parseBackup(JSON.stringify({ ...buildBackup([], [], NOW), videos: [v] }));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.backup.videos[0].thumbnail).toBeUndefined();
		expect(parsed.backup.videos[0].title.length).toBeLessThanOrEqual(500);
	});

	it('cleans collections: unknown video ids go away, a video stays in one collection, bad names are dropped', () => {
		const b = {
			...buildBackup([video(1), video(2)], [], NOW),
			collections: [col('c1', 'Aulas', ['v1', 'ghost', 'v1']), col('c2', 'Outra', ['v1', 'v2']), col('c3', '   ', [])]
		};
		const parsed = parseBackup(JSON.stringify(b));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.backup.collections.map((c) => [c.id, c.order])).toEqual([['c1', ['v1']], ['c2', ['v2']]]);
	});

	it('refuses reserved names and keeps the rest', () => {
		const b = { ...buildBackup([video(1)], [], NOW), collections: [col('c1', 'Todos', ['v1']), col('c2', 'Ok', [])] };
		const parsed = parseBackup(JSON.stringify(b));
		expect(parsed.ok && parsed.backup.collections.map((c) => c.id)).toEqual(['c2']);
	});
});

describe('planImport', () => {
	const incoming = (videos: Video[], collections: Collection[]): Backup => buildBackup(videos, collections, NOW);

	it('into an empty library adds everything unchanged', () => {
		const vs = [video(1), video(2)];
		const cs = [col('c1', 'Aulas', ['v1'], 1), col('c2', 'Música', ['v2'], 0)];
		const plan = planImport([], [], incoming(vs, cs));
		expect(plan.videos).toEqual(vs);
		expect(plan.collections).toEqual(cs);
		expect(plan.summary).toEqual({ addedVideos: 2, skippedVideos: 0, addedCollections: 2, mergedCollections: 0 });
	});

	it('skips a video that is already there (same canonical link); the existing one wins', () => {
		const have = video(1, { id: 'mine', title: 'Mine', favorite: true });
		const plan = planImport([have], [], incoming([video(1, { title: 'Theirs' }), video(2)], []));
		expect(plan.videos.map((v) => v.title)).toEqual(['Video 2']);
		expect(plan.summary.skippedVideos).toBe(1);
	});

	it('a different video that reuses an id gets a new id', () => {
		const have = video(1, { id: 'dup' });
		const plan = planImport([have], [], incoming([video(2, { id: 'dup' })], [col('c1', 'Aulas', ['dup'])]));
		expect(plan.videos).toHaveLength(1);
		expect(plan.videos[0].id).not.toBe('dup');
		expect(plan.collections[0].order).toEqual([plan.videos[0].id]);
	});

	it('merges into a collection with the same id: existing name and rank stay, new videos are appended', () => {
		const have = [video(1)];
		const mine = [col('c1', 'Minha', ['v1'], 0)];
		const plan = planImport(have, mine, incoming([video(2)], [col('c1', 'Deles', ['v2'], 5)]));
		expect(plan.collections).toHaveLength(1);
		expect(plan.collections[0]).toMatchObject({ id: 'c1', name: 'Minha', order: ['v1', 'v2'], rank: 0 });
		expect(plan.summary).toMatchObject({ addedVideos: 1, mergedCollections: 1, addedCollections: 0 });
	});

	it('a skipped duplicate that sits in an incoming collection is not moved out of its own collection', () => {
		const have = [video(1, { id: 'mine' })];
		const mine = [col('keep', 'Keep', ['mine'])];
		const plan = planImport(have, mine, incoming([video(1)], [col('other', 'Other', ['v1'])]));
		expect(plan.collections.find((c) => c.id === 'other')?.order).toEqual([]);
		expect(plan.collections.find((c) => c.id === 'keep')).toBeUndefined();
	});

	it('new collections go after the ones already ranked, keeping their relative order', () => {
		const mine = [col('a', 'A', [], 0), col('b', 'B', [], 1)];
		const plan = planImport([], mine, incoming([], [col('x', 'X', [], 1), col('y', 'Y', [], 0)]));
		const rank = (id: string) => plan.collections.find((c) => c.id === id)!.rank;
		expect(rank('y')).toBe(2);
		expect(rank('x')).toBe(3);
	});

	it('importing the same file twice changes nothing the second time', () => {
		const file = incoming([video(1), video(2)], [col('c1', 'Aulas', ['v1', 'v2'], 0)]);
		const first = planImport([], [], file);
		const second = planImport(first.videos, first.collections, file);
		expect(second.videos).toEqual([]);
		expect(second.summary).toMatchObject({ addedVideos: 0, skippedVideos: 2, addedCollections: 0 });
	});
});

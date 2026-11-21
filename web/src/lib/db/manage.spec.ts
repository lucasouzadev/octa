import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CollectionError, Library, type Video } from '#lib/db/library.ts';
import { ALL, FAVORITES, WATCHED, isVirtual, playlistFor, videosIn } from '#lib/db/scope.ts';

// QA round 2, item 7: delete a video, mark watched, and the two virtual collections.
let lib: Library;
let n = 0;
beforeEach(async () => {
	lib = await Library.open(`manage-${n++}`);
});
afterEach(() => lib.close());

function video(id: string, over: Partial<Video> = {}): Video {
	return {
		id,
		url: `https://youtu.be/${id}`,
		canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
		source: 'youtube',
		kind: 'video',
		embed: { type: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}`, aspect: '16:9' },
		title: id,
		health: 'unknown',
		deadStreak: 0,
		favorite: false,
		createdAt: `2026-11-19T10:00:0${id.length}.000Z`,
		updatedAt: '2026-11-19T10:00:00.000Z',
		...over
	};
}

describe('deleteVideo', () => {
	it('removes the video and takes it out of its collection', async () => {
		await lib.put(video('a'));
		await lib.put(video('bb'));
		const c = await lib.createCollection('Música');
		await lib.moveVideo('a', c.id);
		await lib.moveVideo('bb', c.id);
		await lib.deleteVideo('a');
		expect(await lib.get('a')).toBeUndefined();
		expect((await lib.getCollection(c.id))!.order).toEqual(['bb']);
		expect((await lib.list()).map((v) => v.id)).toEqual(['bb']);
	});

	it('frees the link so it can be pasted again', async () => {
		await lib.put(video('a'));
		await lib.deleteVideo('a');
		expect(await lib.findByCanonical('https://www.youtube.com/watch?v=a')).toBeUndefined();
	});

	it('says not_found for an unknown id', async () => {
		await expect(lib.deleteVideo('zz')).rejects.toBeInstanceOf(CollectionError);
	});
});

describe('restoreVideo (R4.7 undo)', () => {
	it('puts the video back in the same collection at the same place', async () => {
		for (const id of ['a', 'bb', 'ccc']) await lib.put(video(id));
		const c = await lib.createCollection('Música');
		for (const id of ['a', 'bb', 'ccc']) await lib.moveVideo(id, c.id);
		const gone = await lib.deleteVideo('bb');
		expect((await lib.getCollection(c.id))!.order).toEqual(['a', 'ccc']);
		await lib.restoreVideo(gone);
		expect((await lib.getCollection(c.id))!.order).toEqual(['a', 'bb', 'ccc']);
		expect((await lib.get('bb'))!.title).toBe('bb');
	});

	it('keeps what the person had set on the video', async () => {
		await lib.put(video('a', { favorite: true, watched: true, positionSec: 42 }));
		const gone = await lib.deleteVideo('a');
		await lib.restoreVideo(gone);
		const back = (await lib.get('a'))!;
		expect([back.favorite, back.watched, back.positionSec]).toEqual([true, true, 42]);
	});

	it('still restores the video when its collection was deleted meanwhile', async () => {
		await lib.put(video('a'));
		const c = await lib.createCollection('Música');
		await lib.moveVideo('a', c.id);
		const gone = await lib.deleteVideo('a');
		await lib.deleteCollection(c.id);
		await lib.restoreVideo(gone);
		expect(await lib.get('a')).toBeDefined();
	});

	it('does not duplicate a video that is already back', async () => {
		await lib.put(video('a'));
		const c = await lib.createCollection('Música');
		await lib.moveVideo('a', c.id);
		const gone = await lib.deleteVideo('a');
		await lib.restoreVideo(gone);
		await lib.restoreVideo(gone);
		expect((await lib.getCollection(c.id))!.order).toEqual(['a']);
	});
});

describe('reserved names', () => {
	it('keeps the virtual collection names for itself, accents and case aside', async () => {
		for (const name of ['Assistidos', 'assistidos', 'FAVORITOS', 'Favoritos', 'todos']) {
			await expect(lib.createCollection(name)).rejects.toMatchObject({ code: 'reserved_name' });
		}
	});
});

describe('virtual collections', () => {
	it('lists liked videos under Favoritos and watched ones under Assistidos', async () => {
		await lib.put(video('a', { favorite: true }));
		await lib.put(video('bb', { watched: true }));
		await lib.put(video('ccc', { favorite: true, watched: true }));
		await lib.put(video('dddd'));
		expect((await videosIn(lib, FAVORITES)).map((v) => v.id).sort()).toEqual(['a', 'ccc']);
		expect((await videosIn(lib, WATCHED)).map((v) => v.id).sort()).toEqual(['bb', 'ccc']);
		expect(await videosIn(lib, ALL)).toHaveLength(4);
	});

	it('knows which scopes are virtual', () => {
		expect([ALL, FAVORITES, WATCHED].every(isVirtual)).toBe(true);
		expect(isVirtual('0f6c-uuid')).toBe(false);
	});

	it('plays inside a virtual scope only when the video is in it', async () => {
		await lib.put(video('a', { favorite: true }));
		await lib.put(video('bb'));
		expect((await playlistFor(lib, FAVORITES, 'a')).scope).toBe(FAVORITES);
		expect((await playlistFor(lib, FAVORITES, 'bb')).scope).toBe(ALL);
	});
});

describe('watched flag', () => {
	it('is saved and cleared with update', async () => {
		await lib.put(video('a'));
		expect((await lib.update('a', { watched: true })).watched).toBe(true);
		expect((await lib.get('a'))!.watched).toBe(true);
		expect((await lib.update('a', { watched: false })).watched).toBe(false);
	});
});

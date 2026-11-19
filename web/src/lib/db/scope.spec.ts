import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Library, type Video } from '#lib/db/library.ts';
import { ALL, playlistFor, videosIn } from '#lib/db/scope.ts';

let lib: Library;
let n = 0;

beforeEach(async () => {
	lib = await Library.open(`scope-${n++}`);
});
afterEach(() => lib.close());

function video(id: string, createdAt: string): Video {
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
		createdAt,
		updatedAt: createdAt
	};
}

describe('videosIn (what the player and Collection screen play)', () => {
	beforeEach(async () => {
		await lib.put(video('aaaaaaaaaaa', '2026-11-19T10:00:00.000Z'));
		await lib.put(video('bbbbbbbbbbb', '2026-11-19T11:00:00.000Z'));
		await lib.put(video('ccccccccccc', '2026-11-19T12:00:00.000Z'));
	});

	it('"todos" and no scope both mean every video, newest first', async () => {
		expect((await videosIn(lib, ALL)).map((v) => v.id)).toEqual(['ccccccccccc', 'bbbbbbbbbbb', 'aaaaaaaaaaa']);
		expect((await videosIn(lib, null)).map((v) => v.id)).toEqual(['ccccccccccc', 'bbbbbbbbbbb', 'aaaaaaaaaaa']);
	});

	it('a collection scope plays that collection in its own order', async () => {
		const c = await lib.createCollection('Minha');
		await lib.moveVideo('aaaaaaaaaaa', c.id);
		await lib.moveVideo('ccccccccccc', c.id);
		expect((await videosIn(lib, c.id)).map((v) => v.id)).toEqual(['aaaaaaaaaaa', 'ccccccccccc']);
	});

	it('an unknown collection id (deleted, or a stale link) falls back to every video', async () => {
		expect((await videosIn(lib, 'deleted-collection')).map((v) => v.id)).toEqual([
			'ccccccccccc',
			'bbbbbbbbbbb',
			'aaaaaaaaaaa'
		]);
	});
});

describe('playlistFor (the sequence the player walks)', () => {
	beforeEach(async () => {
		await lib.put(video('aaaaaaaaaaa', '2026-11-19T10:00:00.000Z'));
		await lib.put(video('bbbbbbbbbbb', '2026-11-19T11:00:00.000Z'));
	});

	it('keeps the collection scope when the video belongs to it', async () => {
		const c = await lib.createCollection('Sequência');
		await lib.moveVideo('aaaaaaaaaaa', c.id);
		const p = await playlistFor(lib, c.id, 'aaaaaaaaaaa');
		expect(p.scope).toBe(c.id);
		expect(p.videos.map((v) => v.id)).toEqual(['aaaaaaaaaaa']);
	});

	it('falls back to the whole library when the video is not in that collection', async () => {
		const c = await lib.createCollection('Outra');
		await lib.moveVideo('aaaaaaaaaaa', c.id);
		const p = await playlistFor(lib, c.id, 'bbbbbbbbbbb');
		expect(p.scope).toBe(ALL);
		expect(p.videos.map((v) => v.id)).toEqual(['bbbbbbbbbbb', 'aaaaaaaaaaa']);
	});

	it('no scope means the whole library', async () => {
		const p = await playlistFor(lib, null, 'aaaaaaaaaaa');
		expect(p.scope).toBe(ALL);
		expect(p.videos).toHaveLength(2);
	});
});

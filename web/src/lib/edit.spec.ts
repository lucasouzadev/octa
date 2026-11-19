import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Library } from '#lib/db/library.ts';
import { addLink, editVideo, EditError } from '#lib/links.ts';
import { LinkError } from '#lib/providers/parse.ts';
import type { Meta } from '#lib/api.ts';

// QA round 2, item 7: correct a saved link or rename it.
let lib: Library;
let n = 0;
beforeEach(async () => {
	lib = await Library.open(`edit-${n++}`);
});
afterEach(() => lib.close());

const noNetwork = async () => {
	throw new Error('offline');
};
const meta = (id: string, title: string): Meta => ({
	source: 'youtube',
	kind: 'video',
	id,
	canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
	embed: { type: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}`, aspect: '16:9' },
	title,
	author: 'Canal',
	thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
	durationSec: 90,
	health: 'alive',
	checkedAt: '2026-11-19T12:00:00Z'
});

async function saved(id = 'dQw4w9WgXcQ') {
	const { video } = await addLink(`https://youtu.be/${id}`, { library: lib, resolve: noNetwork });
	return video;
}

describe('editVideo title', () => {
	it('renames the video, trimmed, and keeps everything else', async () => {
		const v = await saved();
		await lib.update(v.id, { favorite: true, watched: true });
		const out = await editVideo(v.id, { title: '  Meu título  ' }, { library: lib, resolve: noNetwork });
		expect(out.title).toBe('Meu título');
		expect(out.favorite).toBe(true);
		expect(out.watched).toBe(true);
		expect(out.canonicalUrl).toBe(v.canonicalUrl);
	});

	it('refuses an empty title and one over 300 characters', async () => {
		const v = await saved();
		await expect(editVideo(v.id, { title: '   ' }, { library: lib })).rejects.toMatchObject({ code: 'empty_title' });
		await expect(editVideo(v.id, { title: 'a'.repeat(301) }, { library: lib })).rejects.toMatchObject({ code: 'title_too_long' });
	});
});

describe('editVideo link', () => {
	it('swaps the link, resets health and position, keeps identity and the collection', async () => {
		const v = await saved('dQw4w9WgXcQ');
		const c = await lib.createCollection('Música');
		await lib.moveVideo(v.id, c.id);
		await lib.update(v.id, { positionSec: 40, health: 'dead', deadStreak: 2, favorite: true });
		const out = await editVideo(
			v.id,
			{ url: 'https://youtu.be/9bZkp7q19f0' },
			{ library: lib, resolve: async () => meta('9bZkp7q19f0', 'Outro vídeo') }
		);
		expect(out.id).toBe(v.id);
		expect(out.canonicalUrl).toBe('https://www.youtube.com/watch?v=9bZkp7q19f0');
		expect(out.title).toBe('Outro vídeo');
		expect(out.health).toBe('alive');
		expect(out.deadStreak).toBe(0);
		expect(out.positionSec).toBeUndefined();
		expect(out.favorite).toBe(true);
		expect((await lib.collectionOf(v.id))!.id).toBe(c.id);
		expect(await lib.findByCanonical(v.canonicalUrl)).toBeUndefined();
	});

	it('keeps the title the person typed when the link changes too', async () => {
		const v = await saved();
		const out = await editVideo(
			v.id,
			{ title: 'Meu nome', url: 'https://youtu.be/9bZkp7q19f0' },
			{ library: lib, resolve: async () => meta('9bZkp7q19f0', 'Do YouTube') }
		);
		expect(out.title).toBe('Meu nome');
	});

	it('still saves while offline, with the parser title', async () => {
		const v = await saved();
		const out = await editVideo(v.id, { url: 'https://youtu.be/9bZkp7q19f0' }, { library: lib, resolve: noNetwork });
		expect(out.canonicalUrl).toBe('https://www.youtube.com/watch?v=9bZkp7q19f0');
		expect(out.health).toBe('unknown');
	});

	it('rejects a link that is already another video, and one that is not a link', async () => {
		const a = await saved('dQw4w9WgXcQ');
		await saved('9bZkp7q19f0');
		await expect(editVideo(a.id, { url: 'https://youtu.be/9bZkp7q19f0' }, { library: lib, resolve: noNetwork })).rejects.toMatchObject({
			code: 'duplicate'
		});
		await expect(editVideo(a.id, { url: 'não é link' }, { library: lib })).rejects.toBeInstanceOf(LinkError);
		expect(EditError).toBeDefined();
	});

	it('leaves the same link alone (no network call, no reset)', async () => {
		const v = await saved();
		await lib.update(v.id, { positionSec: 12 });
		const out = await editVideo(v.id, { url: v.url }, { library: lib, resolve: noNetwork });
		expect(out.positionSec).toBe(12);
	});
});

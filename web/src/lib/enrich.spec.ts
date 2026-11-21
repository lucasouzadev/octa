import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Library } from '#lib/db/library.ts';
import { addLink } from '#lib/links.ts';
import { enrichPending, needsEnrich } from '#lib/enrich.ts';
import { ApiError, type Meta } from '#lib/api.ts';
import { LinkError } from '#lib/providers/parse.ts';

let lib: Library;
let n = 0;
beforeEach(async () => {
	lib = await Library.open(`enrich-${n++}`);
});
afterEach(() => lib.close());

const meta = (id: string, over: Partial<Meta> = {}): Meta => ({
	source: 'youtube',
	kind: 'video',
	id,
	canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
	embed: { type: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0`, aspect: '16:9' },
	title: `Título ${id}`,
	author: `Autor ${id}`,
	thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
	durationSec: null,
	health: 'alive',
	checkedAt: '2026-11-19T12:00:00Z',
	...over
});

const down = async () => {
	throw new ApiError(502);
};

// A video saved while the API was asleep: parser fallback only.
async function savedOffline(id: string) {
	const { video } = await addLink(`https://youtu.be/${id}`, { library: lib, resolve: down });
	return video;
}

describe('needsEnrich', () => {
	it('is true for a video the API never described', async () => {
		const v = await savedOffline('dQw4w9WgXcQ');
		expect(v.title).toBe('Vídeo do YouTube');
		expect(needsEnrich(v)).toBe(true);
	});

	it('is false once the API has checked it', async () => {
		const { video } = await addLink('https://youtu.be/dQw4w9WgXcQ', {
			library: lib,
			resolve: async () => meta('dQw4w9WgXcQ')
		});
		expect(needsEnrich(video)).toBe(false);
	});
});

describe('needsEnrich after a health check (R4.1)', () => {
	it('is true for a generic title whose health was checked but whose metadata never arrived', async () => {
		const v = await savedOffline('dQw4w9WgXcQ');
		// the viewer's health check ran: a date and a verdict, still the parser's title
		const checked = await lib.update(v.id, { health: 'alive', checkedAt: new Date().toISOString() });
		expect(checked.title).toBe('Vídeo do YouTube');
		expect(needsEnrich(checked)).toBe(true);
	});

	it('is false once a resolve answered, even if that answer had no title', async () => {
		const v = await savedOffline('dQw4w9WgXcQ');
		const done = await enrichPending(lib, { resolve: async () => meta('dQw4w9WgXcQ', { title: '' }) });
		expect(done).toBe(1);
		const [after] = await lib.list();
		expect(after.title).toBe('Vídeo do YouTube');
		expect(after.metaAt).toBeDefined();
		expect(needsEnrich(after)).toBe(false);
		expect(after.id).toBe(v.id);
	});

	it('is false for a title the person or the API chose', async () => {
		const v = await savedOffline('dQw4w9WgXcQ');
		const checked = await lib.update(v.id, { title: 'Meu título', health: 'alive', checkedAt: new Date().toISOString() });
		expect(needsEnrich(checked)).toBe(false);
	});

	it('is false for a TikTok handle title: that is the best it will ever get', async () => {
		const { video } = await addLink('https://www.tiktok.com/@nota.solta/video/7300000000000000001', {
			library: lib,
			resolve: async () => {
				throw new ApiError(503);
			}
		});
		const checked = await lib.update(video.id, { health: 'alive', checkedAt: new Date().toISOString() });
		expect(checked.title).toBe('Vídeo de @nota.solta');
		expect(needsEnrich(checked)).toBe(false);
	});
});

describe('enrichPending', () => {
	it('fills title, author, thumbnail and health of videos saved offline', async () => {
		const v = await savedOffline('dQw4w9WgXcQ');
		const done = await enrichPending(lib, { resolve: async () => meta('dQw4w9WgXcQ') });
		expect(done).toBe(1);
		const [after] = await lib.list();
		expect(after.id).toBe(v.id);
		expect(after.title).toBe('Título dQw4w9WgXcQ');
		expect(after.author).toBe('Autor dQw4w9WgXcQ');
		expect(after.health).toBe('alive');
		expect(after.checkedAt).toBe('2026-11-19T12:00:00Z');
	});

	it('keeps what the user did meanwhile (favorite, collection)', async () => {
		const v = await savedOffline('dQw4w9WgXcQ');
		const c = await lib.createCollection('Música');
		await lib.moveVideo(v.id, c.id);
		await lib.update(v.id, { favorite: true });
		await enrichPending(lib, { resolve: async () => meta('dQw4w9WgXcQ') });
		const [after] = await lib.list();
		expect(after.favorite).toBe(true);
		expect((await lib.collectionOf(v.id))?.id).toBe(c.id);
	});

	it('never calls the API for videos that are already described', async () => {
		await addLink('https://youtu.be/dQw4w9WgXcQ', { library: lib, resolve: async () => meta('dQw4w9WgXcQ') });
		let calls = 0;
		const done = await enrichPending(lib, {
			resolve: async () => {
				calls++;
				return meta('x');
			}
		});
		expect(done).toBe(0);
		expect(calls).toBe(0);
	});

	it('leaves the video as it was when the API is still down, and does not throw', async () => {
		await savedOffline('dQw4w9WgXcQ');
		const done = await enrichPending(lib, { resolve: down });
		expect(done).toBe(0);
		const [after] = await lib.list();
		expect(after.title).toBe('Vídeo do YouTube');
		expect(needsEnrich(after)).toBe(true);
	});

	it('survives an API that rejects the link (422)', async () => {
		await savedOffline('dQw4w9WgXcQ');
		const done = await enrichPending(lib, {
			resolve: async () => {
				throw new LinkError('invalid_url');
			}
		});
		expect(done).toBe(0);
	});

	it('does one video at a time and stops at the limit', async () => {
		for (const id of ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc']) await savedOffline(id);
		let running = 0;
		let peak = 0;
		const done = await enrichPending(
			lib,
			{
				resolve: async (url) => {
					running++;
					peak = Math.max(peak, running);
					await new Promise((r) => setTimeout(r, 5));
					running--;
					return meta(url.slice(-11));
				}
			},
			{ max: 2 }
		);
		expect(done).toBe(2);
		expect(peak).toBe(1);
		expect((await lib.list()).filter(needsEnrich)).toHaveLength(1);
	});

	it('ignores a title that is empty after cleaning and keeps the fallback', async () => {
		await savedOffline('dQw4w9WgXcQ');
		await enrichPending(lib, { resolve: async () => meta('dQw4w9WgXcQ', { title: '   ' }) });
		const [after] = await lib.list();
		expect(after.title).toBe('Vídeo do YouTube');
		expect(after.health).toBe('alive');
	});
});

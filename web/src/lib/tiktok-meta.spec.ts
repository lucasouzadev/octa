import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Library, type Video } from '#lib/db/library.ts';
import { addLink, metaPatch, tiktokHandle, upgradeGenericTitles } from '#lib/links.ts';
import { ApiError, type Meta } from '#lib/api.ts';

// TikTok's public oEmbed answers 200 without title, author_name or thumbnail_url
// (checked 2026-11-20), so the API returns its own generic title and no cover.
// The client builds the title from the @handle that is already in the URL.

let lib: Library;
let n = 0;

beforeEach(async () => {
	lib = await Library.open(`tiktok-meta-${n++}`);
});
afterEach(() => lib.close());

const URL_OK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173';

const ttMeta = (over: Partial<Meta> = {}): Meta => ({
	source: 'tiktok',
	kind: 'short',
	id: '6718335390845095173',
	canonicalUrl: URL_OK,
	embed: { type: 'iframe', src: 'https://www.tiktok.com/player/v1/6718335390845095173?controls=0', aspect: '9:16' },
	title: 'Vídeo do TikTok',
	durationSec: null,
	health: 'alive',
	checkedAt: '2026-11-20T10:13:22Z',
	...over
});

describe('tiktokHandle', () => {
	it('reads the @handle from a canonical TikTok video URL', () => {
		expect(tiktokHandle(URL_OK)).toBe('@scout2015');
		expect(tiktokHandle('https://www.tiktok.com/@a.b_c-1/video/123')).toBe('@a.b_c-1');
	});

	it('is undefined for anything that is not a canonical TikTok video URL', () => {
		expect(tiktokHandle('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeUndefined();
		expect(tiktokHandle('https://www.tiktok.com/@scout2015')).toBeUndefined();
		expect(tiktokHandle('not a url')).toBeUndefined();
	});
});

describe('addLink with a TikTok link', () => {
	it('titles the video "Vídeo de @handle" when the API only sends its generic title', async () => {
		const { video } = await addLink(URL_OK, { library: lib, resolve: async () => ttMeta() });
		expect(video.title).toBe('Vídeo de @scout2015');
		expect(video.author).toBe('@scout2015');
		expect(video.thumbnail).toBeUndefined();
	});

	it('keeps a real title and author when the API has them', async () => {
		const { video } = await addLink(URL_OK, {
			library: lib,
			resolve: async () => ttMeta({ title: 'Meu primeiro passo', author: 'Scout' })
		});
		expect(video.title).toBe('Meu primeiro passo');
		expect(video.author).toBe('Scout');
	});

	it('uses the handle title when the API is down too', async () => {
		const { video } = await addLink(URL_OK, {
			library: lib,
			resolve: async () => {
				throw new ApiError(502);
			}
		});
		expect(video.title).toBe('Vídeo de @scout2015');
	});

	it('metaPatch never writes the API generic TikTok title over the handle title', () => {
		expect(metaPatch(ttMeta())).not.toHaveProperty('title');
		expect(metaPatch(ttMeta({ title: 'Outro' }))).toMatchObject({ title: 'Outro' });
	});
});

describe('upgradeGenericTitles', () => {
	const saved = (over: Partial<Video>): Video => ({
		id: crypto.randomUUID(),
		url: URL_OK,
		canonicalUrl: URL_OK,
		source: 'tiktok',
		kind: 'short',
		embed: { type: 'iframe', src: 'https://www.tiktok.com/player/v1/6718335390845095173', aspect: '9:16' },
		title: 'Vídeo do TikTok',
		health: 'alive',
		deadStreak: 0,
		favorite: false,
		createdAt: '2026-11-19T10:00:00Z',
		updatedAt: '2026-11-19T10:00:00Z',
		...over
	});

	it('gives already saved TikToks the handle title, and only when the title is the generic one', async () => {
		const generic = await lib.put(saved({}));
		const edited = await lib.put(
			saved({
				canonicalUrl: 'https://www.tiktok.com/@maria/video/111',
				url: 'https://www.tiktok.com/@maria/video/111',
				title: 'Meu título'
			})
		);
		const yt = await lib.put(
			saved({
				source: 'youtube',
				canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
				url: 'https://youtu.be/dQw4w9WgXcQ',
				title: 'Vídeo do TikTok'
			})
		);

		expect(await upgradeGenericTitles(lib)).toBe(1);

		expect((await lib.get(generic.id))?.title).toBe('Vídeo de @scout2015');
		expect((await lib.get(generic.id))?.author).toBe('@scout2015');
		expect((await lib.get(edited.id))?.title).toBe('Meu título');
		expect((await lib.get(yt.id))?.title).toBe('Vídeo do TikTok');
	});

	it('is idempotent and keeps an author the API already gave', async () => {
		const v = await lib.put(saved({ author: 'Scout' }));
		expect(await upgradeGenericTitles(lib)).toBe(1);
		expect(await upgradeGenericTitles(lib)).toBe(0);
		expect((await lib.get(v.id))?.author).toBe('Scout');
	});
});

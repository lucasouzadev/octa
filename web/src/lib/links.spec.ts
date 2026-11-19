import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Library } from '#lib/db/library.ts';
import { addLink } from '#lib/links.ts';
import { ApiError, type Meta } from '#lib/api.ts';
import { LinkError } from '#lib/providers/parse.ts';

let lib: Library;
let n = 0;

beforeEach(async () => {
	lib = await Library.open(`test-${n++}`);
});
afterEach(() => lib.close());

const aliveMeta = (over: Partial<Meta> = {}): Meta => ({
	source: 'youtube',
	kind: 'video',
	id: 'dQw4w9WgXcQ',
	canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
	embed: { type: 'iframe', src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?playsinline=1&rel=0', aspect: '16:9' },
	title: 'Sessão ao vivo',
	author: 'Casa Aberta',
	thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
	durationSec: null,
	health: 'alive',
	checkedAt: '2026-11-19T12:00:00Z',
	...over
});

describe('addLink', () => {
	it('saves a resolved video with API metadata', async () => {
		const { video, created } = await addLink('https://youtu.be/dQw4w9WgXcQ', {
			library: lib,
			resolve: async () => aliveMeta()
		});
		expect(created).toBe(true);
		expect(video.title).toBe('Sessão ao vivo');
		expect(video.health).toBe('alive');
		expect((await lib.list()).map((v) => v.id)).toEqual([video.id]);
	});

	it('still saves from the client parser when the API is down', async () => {
		const { video } = await addLink('https://www.youtube.com/shorts/aBcDeFgHiJ0', {
			library: lib,
			resolve: async () => {
				throw new ApiError(502);
			}
		});
		expect(video.kind).toBe('short');
		expect(video.embed.aspect).toBe('9:16');
		expect(video.health).toBe('unknown');
		expect(video.thumbnail).toBe('https://i.ytimg.com/vi/aBcDeFgHiJ0/hqdefault.jpg');
		expect(video.title).toBe('Vídeo do YouTube');
	});

	it('returns the existing item for a duplicate link instead of saving twice', async () => {
		const deps = { library: lib, resolve: async () => aliveMeta() };
		const first = await addLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=a', deps);
		const second = await addLink('https://youtu.be/dQw4w9WgXcQ', deps);
		expect(second.created).toBe(false);
		expect(second.video.id).toBe(first.video.id);
		expect(await lib.list()).toHaveLength(1);
	});

	it('rejects unsupported links without saving or calling the API', async () => {
		let called = false;
		await expect(
			addLink('https://example.com/page', {
				library: lib,
				resolve: async () => {
					called = true;
					return aliveMeta();
				}
			})
		).rejects.toBeInstanceOf(LinkError);
		expect(called).toBe(false);
		expect(await lib.list()).toHaveLength(0);
	});

	it('ignores API fields that try to change the identity of the video', async () => {
		const { video } = await addLink('https://youtu.be/dQw4w9WgXcQ', {
			library: lib,
			resolve: async () =>
				aliveMeta({
					canonicalUrl: 'https://evil.example/',
					embed: { type: 'iframe', src: 'https://evil.example/embed', aspect: '16:9' }
				})
		});
		expect(video.canonicalUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
		expect(video.embed.src).toContain('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
	});

	it('names direct files after the file and keeps API out of the title', async () => {
		const { video } = await addLink('https://cdn.example.com/media/Ensaio%20aberto.mp4', {
			library: lib,
			resolve: async () => ({ ...aliveMeta(), source: 'direct', title: 'Ensaio aberto' })
		});
		expect(video.title).toBe('Ensaio aberto');
		expect(video.embed.type).toBe('video');
	});
});

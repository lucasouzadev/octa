import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Library } from '#lib/db/library.ts';
import { addLink, EXPAND_TIMEOUT_MS } from '#lib/links.ts';
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

describe('addLink double paste', () => {
	it('two simultaneous pastes of the same link save one video and both get it back', async () => {
		const slow = async () => {
			await new Promise((r) => setTimeout(r, 20));
			return aliveMeta();
		};
		const [a, b] = await Promise.all([
			addLink('https://youtu.be/dQw4w9WgXcQ', { library: lib, resolve: slow }),
			addLink('https://youtu.be/dQw4w9WgXcQ', { library: lib, resolve: slow })
		]);
		expect(a.video.id).toBe(b.video.id);
		expect([a.created, b.created].sort()).toEqual([false, true]);
		expect(await lib.list()).toHaveLength(1);
	});
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

describe('addLink: TikTok short links (only the API can follow the redirect)', () => {
	const tiktokMeta = (over: Partial<Meta> = {}): Meta =>
		aliveMeta({
			source: 'tiktok',
			kind: 'short',
			id: '7234567890123456789',
			canonicalUrl: 'https://www.tiktok.com/@u/video/7234567890123456789',
			embed: { type: 'iframe', src: 'https://www.tiktok.com/embed/v2/7234567890123456789', aspect: '9:16' },
			title: 'Receita rápida',
			thumbnail: undefined,
			...over
		});

	it('asks the API, then trusts only what the client parser makes of the canonical URL', async () => {
		let asked = 0;
		const { video } = await addLink('https://vm.tiktok.com/ZMabc123/', {
			library: lib,
			resolve: async () => (asked++, tiktokMeta())
		});
		expect(asked).toBe(1); // not asked a second time for metadata
		expect(video.source).toBe('tiktok');
		expect(video.canonicalUrl).toBe('https://www.tiktok.com/@u/video/7234567890123456789');
		expect(video.embed.src).toMatch(/^https:\/\/www\.tiktok\.com\/player\/v1\/7234567890123456789\?controls=0/);
		expect(video.title).toBe('Receita rápida');
	});

	it('says the resolver is unavailable (not "unsupported") when the API is down: nothing is saved', async () => {
		await expect(
			addLink('https://vm.tiktok.com/ZMabc123/', {
				library: lib,
				resolve: async () => {
					throw new ApiError(502);
				}
			})
		).rejects.toMatchObject({ code: 'resolver_unavailable' });
		expect(await lib.list()).toHaveLength(0);
	});

	it('says the resolver is unavailable when the request never reaches the API (wrong base, offline)', async () => {
		await expect(
			addLink('https://vt.tiktok.com/ZSabc123/', {
				library: lib,
				resolve: async () => {
					throw new TypeError('Failed to fetch');
				}
			})
		).rejects.toMatchObject({ code: 'resolver_unavailable' });
		expect(await lib.list()).toHaveLength(0);
	});

	it('says the resolver is unavailable when the API takes longer than the expand timeout', async () => {
		await expect(
			addLink('https://vt.tiktok.com/ZSabc123/', {
				library: lib,
				expandTimeoutMs: 20,
				resolve: (_url, signal) =>
					new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))
			})
		).rejects.toMatchObject({ code: 'resolver_unavailable' });
		expect(await lib.list()).toHaveLength(0);
	});

	it('keeps "unsupported" when the API itself answers that the short link is not a TikTok video', async () => {
		await expect(
			addLink('https://vt.tiktok.com/ZSabc123/', {
				library: lib,
				resolve: async () => {
					throw new LinkError('unsupported_url');
				}
			})
		).rejects.toMatchObject({ code: 'unsupported_url' });
	});

	it('waits long enough for a free-tier API that is waking up (expand timeout >= 15 s)', () => {
		expect(EXPAND_TIMEOUT_MS).toBeGreaterThanOrEqual(15_000);
	});

	it('is unsupported when the API points somewhere that is not a TikTok video', async () => {
		await expect(
			addLink('https://vm.tiktok.com/ZMabc123/', {
				library: lib,
				resolve: async () => tiktokMeta({ canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
			})
		).rejects.toBeInstanceOf(LinkError);
	});

	it('does not ask the API to expand other unsupported links', async () => {
		let asked = 0;
		await expect(addLink('https://example.com/x', { library: lib, resolve: async () => (asked++, tiktokMeta()) })).rejects.toBeInstanceOf(LinkError);
		expect(asked).toBe(0);
	});
});

describe('newId', () => {
	it('works where crypto.randomUUID is missing (http on the local network, e.g. iPhone testing)', async () => {
		const { newId } = await import('#lib/links.ts');
		const original = crypto.randomUUID;
		// @ts-expect-error simulate an insecure context
		crypto.randomUUID = undefined;
		try {
			const a = newId();
			const b = newId();
			expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
			expect(a).not.toBe(b);
		} finally {
			crypto.randomUUID = original;
		}
	});
});

import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseBackup } from '#lib/backup.ts';
import { parseLink } from '#lib/providers/parse.ts';
import { CollectionError, Library, type Video } from '#lib/db/library.ts';

let lib: Library;
let n = 0;
let name: string;

beforeEach(async () => {
	name = `collections-${n++}`;
	lib = await Library.open(name);
});
afterEach(() => lib.close());

function video(id: string, createdAt = '2026-11-19T10:00:00.000Z'): Video {
	return {
		id,
		url: `https://youtu.be/${id}`,
		canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
		source: 'youtube',
		kind: 'video',
		embed: { type: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}`, aspect: '16:9' },
		title: `Vídeo ${id}`,
		health: 'unknown',
		deadStreak: 0,
		favorite: false,
		createdAt,
		updatedAt: createdAt
	};
}

async function code(p: Promise<unknown>): Promise<string> {
	try {
		await p;
	} catch (e) {
		if (e instanceof CollectionError) return e.code;
		throw e;
	}
	return 'no error';
}

describe('schema v1 → v2 migration', () => {
	it('keeps every video saved by a v1 database and starts with no collections', async () => {
		const v1Name = `legacy-${n++}`;
		const old = await openDB(v1Name, 1, {
			upgrade(db) {
				const videos = db.createObjectStore('videos', { keyPath: 'id' });
				videos.createIndex('canonicalUrl', 'canonicalUrl', { unique: true });
				videos.createIndex('createdAt', 'createdAt');
			}
		});
		await old.put('videos', video('aaaaaaaaaaa', '2026-11-18T10:00:00.000Z'));
		await old.put('videos', video('bbbbbbbbbbb', '2026-11-19T10:00:00.000Z'));
		old.close();

		const upgraded = await Library.open(v1Name);
		try {
			expect((await upgraded.list()).map((v) => v.id)).toEqual(['bbbbbbbbbbb', 'aaaaaaaaaaa']);
			expect(await upgraded.listCollections()).toEqual([]);
		} finally {
			upgraded.close();
		}
	});
});

describe('createCollection / renameCollection', () => {
	it('trims the name and stores an empty ordered list', async () => {
		const c = await lib.createCollection('  Receitas  ');
		expect(c.name).toBe('Receitas');
		expect(c.order).toEqual([]);
		expect((await lib.listCollections()).map((x) => x.id)).toEqual([c.id]);
	});

	it('rejects an empty or whitespace-only name', async () => {
		expect(await code(lib.createCollection('   '))).toBe('empty_name');
	});

	it('rejects names longer than 60 characters', async () => {
		expect(await code(lib.createCollection('a'.repeat(61)))).toBe('name_too_long');
	});

	it('reserves "Todos" (the virtual collection), ignoring case and accents', async () => {
		expect(await code(lib.createCollection('todos'))).toBe('reserved_name');
		expect(await code(lib.createCollection('TODOS'))).toBe('reserved_name');
	});

	it('renames with the same validation', async () => {
		const c = await lib.createCollection('Receitas');
		const renamed = await lib.renameCollection(c.id, ' Culinária ');
		expect(renamed.name).toBe('Culinária');
		expect(await code(lib.renameCollection(c.id, ''))).toBe('empty_name');
		expect(await code(lib.renameCollection('missing', 'x'))).toBe('not_found');
	});

	it('lists collections oldest first', async () => {
		const a = await lib.createCollection('A');
		const b = await lib.createCollection('B');
		expect((await lib.listCollections()).map((c) => c.id)).toEqual([a.id, b.id]);
	});
});

describe('moveVideo (one collection per video)', () => {
	it('appends the video to the target collection', async () => {
		await lib.put(video('aaaaaaaaaaa'));
		await lib.put(video('bbbbbbbbbbb'));
		const c = await lib.createCollection('Música');
		await lib.moveVideo('aaaaaaaaaaa', c.id);
		await lib.moveVideo('bbbbbbbbbbb', c.id);
		expect((await lib.getCollection(c.id))?.order).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb']);
		expect((await lib.collectionOf('aaaaaaaaaaa'))?.id).toBe(c.id);
	});

	it('removes the video from its previous collection when moved', async () => {
		await lib.put(video('aaaaaaaaaaa'));
		const from = await lib.createCollection('De');
		const to = await lib.createCollection('Para');
		await lib.moveVideo('aaaaaaaaaaa', from.id);
		await lib.moveVideo('aaaaaaaaaaa', to.id);
		expect((await lib.getCollection(from.id))?.order).toEqual([]);
		expect((await lib.getCollection(to.id))?.order).toEqual(['aaaaaaaaaaa']);
	});

	it('moving to the collection it is already in does not duplicate it', async () => {
		await lib.put(video('aaaaaaaaaaa'));
		const c = await lib.createCollection('Só uma vez');
		await lib.moveVideo('aaaaaaaaaaa', c.id);
		await lib.moveVideo('aaaaaaaaaaa', c.id);
		expect((await lib.getCollection(c.id))?.order).toEqual(['aaaaaaaaaaa']);
	});

	it('moving to null takes the video out of every collection but keeps it in the library', async () => {
		await lib.put(video('aaaaaaaaaaa'));
		const c = await lib.createCollection('Temp');
		await lib.moveVideo('aaaaaaaaaaa', c.id);
		await lib.moveVideo('aaaaaaaaaaa', null);
		expect((await lib.getCollection(c.id))?.order).toEqual([]);
		expect(await lib.collectionOf('aaaaaaaaaaa')).toBeUndefined();
		expect((await lib.list()).map((v) => v.id)).toEqual(['aaaaaaaaaaa']);
	});

	it('refuses an unknown video or collection and changes nothing', async () => {
		await lib.put(video('aaaaaaaaaaa'));
		const c = await lib.createCollection('C');
		expect(await code(lib.moveVideo('ghost', c.id))).toBe('not_found');
		expect(await code(lib.moveVideo('aaaaaaaaaaa', 'missing'))).toBe('not_found');
		expect((await lib.getCollection(c.id))?.order).toEqual([]);
	});
});

describe('deleteCollection', () => {
	it('deletes only the collection; its videos stay in the library', async () => {
		await lib.put(video('aaaaaaaaaaa'));
		const c = await lib.createCollection('Apagar');
		await lib.moveVideo('aaaaaaaaaaa', c.id);
		await lib.deleteCollection(c.id);
		expect(await lib.getCollection(c.id)).toBeUndefined();
		expect(await lib.collectionOf('aaaaaaaaaaa')).toBeUndefined();
		expect((await lib.list()).map((v) => v.id)).toEqual(['aaaaaaaaaaa']);
	});

	it('reports not_found for an unknown id', async () => {
		expect(await code(lib.deleteCollection('missing'))).toBe('not_found');
	});
});

describe('listVideos / reorder', () => {
	it('returns the collection videos in collection order', async () => {
		await lib.put(video('aaaaaaaaaaa', '2026-11-19T10:00:00.000Z'));
		await lib.put(video('bbbbbbbbbbb', '2026-11-19T11:00:00.000Z'));
		const c = await lib.createCollection('Ordem');
		await lib.moveVideo('bbbbbbbbbbb', c.id);
		await lib.moveVideo('aaaaaaaaaaa', c.id);
		expect((await lib.listVideos(c.id)).map((v) => v.id)).toEqual(['bbbbbbbbbbb', 'aaaaaaaaaaa']);
	});

	it('skips ids that no longer have a video (no ghost entries)', async () => {
		await lib.put(video('aaaaaaaaaaa'));
		const c = await lib.createCollection('Fantasma');
		await lib.moveVideo('aaaaaaaaaaa', c.id);
		const raw = await openDB(name);
		await raw.delete('videos', 'aaaaaaaaaaa');
		raw.close();
		expect(await lib.listVideos(c.id)).toEqual([]);
	});

	it('reorder accepts a permutation of the same ids', async () => {
		await lib.put(video('aaaaaaaaaaa'));
		await lib.put(video('bbbbbbbbbbb'));
		const c = await lib.createCollection('R');
		await lib.moveVideo('aaaaaaaaaaa', c.id);
		await lib.moveVideo('bbbbbbbbbbb', c.id);
		await lib.reorder(c.id, ['bbbbbbbbbbb', 'aaaaaaaaaaa']);
		expect((await lib.getCollection(c.id))?.order).toEqual(['bbbbbbbbbbb', 'aaaaaaaaaaa']);
	});

	it('reorder rejects a different set of ids and changes nothing', async () => {
		await lib.put(video('aaaaaaaaaaa'));
		const c = await lib.createCollection('R2');
		await lib.moveVideo('aaaaaaaaaaa', c.id);
		expect(await code(lib.reorder(c.id, ['aaaaaaaaaaa', 'zzzzzzzzzzz']))).toBe('bad_order');
		expect(await code(lib.reorder(c.id, []))).toBe('bad_order');
		expect((await lib.getCollection(c.id))?.order).toEqual(['aaaaaaaaaaa']);
	});
});

describe('setCollectionRanks', () => {
	it('stores the order and keeps every other field', async () => {
		const a = await lib.createCollection('Aulas');
		const b = await lib.createCollection('Música');
		await lib.setCollectionRanks([b.id, a.id]);
		const stored = await lib.listCollections();
		expect(stored.find((c) => c.id === b.id)?.rank).toBe(0);
		expect(stored.find((c) => c.id === a.id)?.rank).toBe(1);
		expect(stored.find((c) => c.id === a.id)?.updatedAt).toBe(a.updatedAt);
		expect(stored.find((c) => c.id === a.id)?.name).toBe('Aulas');
	});
	it('rejects a list that is not exactly the stored collections', async () => {
		const a = await lib.createCollection('Aulas');
		await lib.createCollection('Música');
		expect(await code(lib.setCollectionRanks([a.id]))).toBe('bad_order');
		expect(await code(lib.setCollectionRanks([a.id, a.id]))).toBe('bad_order');
		expect(await code(lib.setCollectionRanks([a.id, 'nope']))).toBe('bad_order');
		expect((await lib.listCollections()).every((c) => c.rank === undefined)).toBe(true);
	});
});

// Import rebuilds the embed from the link, so the fixture must carry the real one.
const real = (id: string): Video => ({ ...video(id), embed: parseLink(`https://youtu.be/${id}`).embed });

describe('exportAll / importBackup', () => {
	it('moves a whole library into a fresh one with nothing lost', async () => {
		const a = await lib.createCollection('Aulas');
		const b = await lib.createCollection('Música');
		const v1 = await lib.put(real('abcdefghij1'));
		const v2 = await lib.put(real('abcdefghij2'));
		await lib.moveVideo(v1.id, a.id);
		await lib.update(v2.id, { favorite: true, positionSec: 30 });
		await lib.setCollectionRanks([b.id, a.id]);
		const file = JSON.parse(JSON.stringify(await lib.exportAll()));

		const fresh = await Library.open(`octa-import-${Math.random()}`);
		const parsed = parseBackup(JSON.stringify(file));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(await fresh.importBackup(parsed.backup)).toMatchObject({ addedVideos: 2, addedCollections: 2 });
		expect(await fresh.list()).toEqual(await lib.list());
		expect((await fresh.listCollections()).sort((x, y) => x.id.localeCompare(y.id))).toEqual((await lib.listCollections()).sort((x, y) => x.id.localeCompare(y.id)));
		// Same file again: nothing new.
		expect(await fresh.importBackup(parsed.backup)).toMatchObject({ addedVideos: 0, addedCollections: 0, mergedCollections: 0 });
		fresh.close();
	});
});

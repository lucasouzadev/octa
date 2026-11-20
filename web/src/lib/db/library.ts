// The user's library lives on the device (ADR-0001). Schema: ARCHITECTURE §5.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Embed, Kind, Source } from '#lib/providers/parse.ts';
import { buildBackup, planImport, type Backup, type ImportSummary } from '#lib/backup.ts';
import { newId } from '#lib/id.ts';

export type Health = 'alive' | 'dead' | 'restricted' | 'unknown';

export interface Video {
	id: string;
	url: string;
	canonicalUrl: string;
	source: Source;
	kind: Kind;
	embed: Embed;
	title: string;
	author?: string;
	thumbnail?: string;
	durationSec?: number;
	health: Health;
	checkedAt?: string;
	deadStreak: number;
	favorite: boolean;
	/** Marked as watched by the person (or when a native video ends). */
	watched?: boolean;
	positionSec?: number;
	lastOpenedAt?: string;
	createdAt: string;
	updatedAt: string;
}

/** A user collection. "Todos" is virtual (every video) and never stored. */
export interface Collection {
	id: string;
	name: string;
	/** Video ids, in play order. A video is in at most one collection. */
	order: string[];
	createdAt: string;
	updatedAt: string;
	/** Place the person gave it on the Library (0 = first). Absent until they reorder. */
	rank?: number;
}

export type CollectionErrorCode = 'empty_name' | 'name_too_long' | 'reserved_name' | 'not_found' | 'bad_order';

export class CollectionError extends Error {
	constructor(readonly code: CollectionErrorCode) {
		super(code);
		this.name = 'CollectionError';
	}
}

export const COLLECTION_NAME_MAX = 60;

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// Names the virtual collections use: "Todos", "Assistidos" and "Favoritos".
const RESERVED = new Set(['todos', 'assistidos', 'favoritos']);

function cleanName(raw: string): string {
	const name = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
	if (!name) throw new CollectionError('empty_name');
	if (name.length > COLLECTION_NAME_MAX) throw new CollectionError('name_too_long');
	if (RESERVED.has(fold(name))) throw new CollectionError('reserved_name');
	return name;
}

// Strictly increasing within this tab so "oldest first" never ties.
let lastStamp = 0;
function stamp(): string {
	lastStamp = Math.max(Date.now(), lastStamp + 1);
	return new Date(lastStamp).toISOString();
}

interface OctaDB extends DBSchema {
	videos: {
		key: string;
		value: Video;
		indexes: { canonicalUrl: string; createdAt: string };
	};
	collections: {
		key: string;
		value: Collection;
		indexes: { createdAt: string };
	};
}

export const DB_NAME = 'octa';
const DB_VERSION = 2;

export class Library {
	private constructor(private db: IDBPDatabase<OctaDB>) {}

	static async open(name = DB_NAME): Promise<Library> {
		const db = await openDB<OctaDB>(name, DB_VERSION, {
			upgrade(db, oldVersion) {
				// Additive only: an upgrade never touches existing videos.
				if (oldVersion < 1) {
					const videos = db.createObjectStore('videos', { keyPath: 'id' });
					videos.createIndex('canonicalUrl', 'canonicalUrl', { unique: true });
					videos.createIndex('createdAt', 'createdAt');
				}
				if (oldVersion < 2) {
					const collections = db.createObjectStore('collections', { keyPath: 'id' });
					collections.createIndex('createdAt', 'createdAt');
				}
			}
		});
		return new Library(db);
	}

	findByCanonical(canonicalUrl: string): Promise<Video | undefined> {
		return this.db.getFromIndex('videos', 'canonicalUrl', canonicalUrl);
	}

	get(id: string): Promise<Video | undefined> {
		return this.db.get('videos', id);
	}

	/** Newest first. */
	async list(): Promise<Video[]> {
		return (await this.db.getAllFromIndex('videos', 'createdAt')).reverse();
	}

	async put(video: Video): Promise<Video> {
		await this.db.put('videos', video);
		return video;
	}

	async update(id: string, patch: Partial<Omit<Video, 'id' | 'createdAt'>>): Promise<Video> {
		const tx = this.db.transaction('videos', 'readwrite');
		const current = await tx.store.get(id);
		if (!current) throw new Error(`video ${id} not found`);
		const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
		await tx.store.put(next);
		await tx.done;
		return next;
	}

	/** Removes the video for good and takes it out of its collection. */
	async deleteVideo(id: string): Promise<void> {
		const tx = this.db.transaction(['videos', 'collections'], 'readwrite');
		if (!(await tx.objectStore('videos').get(id))) throw new CollectionError('not_found');
		await tx.objectStore('videos').delete(id);
		const collections = tx.objectStore('collections');
		for (const c of await collections.getAll()) {
			if (c.order.includes(id)) await collections.put({ ...c, order: c.order.filter((x) => x !== id), updatedAt: stamp() });
		}
		await tx.done;
	}

	listCollections(): Promise<Collection[]> {
		return this.db.getAllFromIndex('collections', 'createdAt');
	}

	getCollection(id: string): Promise<Collection | undefined> {
		return this.db.get('collections', id);
	}

	async createCollection(rawName: string): Promise<Collection> {
		const name = cleanName(rawName);
		const now = stamp();
		const collection: Collection = { id: newId(), name, order: [], createdAt: now, updatedAt: now };
		await this.db.put('collections', collection);
		return collection;
	}

	async renameCollection(id: string, rawName: string): Promise<Collection> {
		const name = cleanName(rawName);
		const tx = this.db.transaction('collections', 'readwrite');
		const current = await tx.store.get(id);
		if (!current) throw new CollectionError('not_found');
		const next = { ...current, name, updatedAt: stamp() };
		await tx.store.put(next);
		await tx.done;
		return next;
	}

	/** Deletes the collection only; its videos stay in the library (and in "Todos"). */
	async deleteCollection(id: string): Promise<void> {
		const tx = this.db.transaction('collections', 'readwrite');
		if (!(await tx.store.get(id))) throw new CollectionError('not_found');
		await tx.store.delete(id);
		await tx.done;
	}

	/**
	 * Puts the video at the end of `collectionId` (or in none when null),
	 * removing it from wherever it was. One transaction: all or nothing.
	 */
	async moveVideo(videoId: string, collectionId: string | null): Promise<void> {
		const tx = this.db.transaction(['videos', 'collections'], 'readwrite');
		const videos = tx.objectStore('videos');
		const collections = tx.objectStore('collections');
		if (!(await videos.get(videoId))) throw new CollectionError('not_found');
		const target = collectionId === null ? null : ((await collections.get(collectionId)) ?? null);
		if (collectionId !== null && !target) throw new CollectionError('not_found');
		for (const c of await collections.getAll()) {
			const has = c.order.includes(videoId);
			if (c.id === collectionId) {
				if (!has) await collections.put({ ...c, order: [...c.order, videoId], updatedAt: stamp() });
			} else if (has) {
				await collections.put({ ...c, order: c.order.filter((x) => x !== videoId), updatedAt: stamp() });
			}
		}
		await tx.done;
	}

	async collectionOf(videoId: string): Promise<Collection | undefined> {
		return (await this.db.getAll('collections')).find((c) => c.order.includes(videoId));
	}

	/** The collection's videos in play order; ids without a video are skipped. */
	async listVideos(collectionId: string): Promise<Video[]> {
		const c = await this.db.get('collections', collectionId);
		if (!c) throw new CollectionError('not_found');
		const found = await Promise.all(c.order.map((id) => this.db.get('videos', id)));
		return found.filter((v): v is Video => v !== undefined);
	}

	/** `ids` must be a permutation of the current order. */
	async reorder(collectionId: string, ids: string[]): Promise<Collection> {
		const tx = this.db.transaction('collections', 'readwrite');
		const c = await tx.store.get(collectionId);
		if (!c) throw new CollectionError('not_found');
		const same =
			ids.length === c.order.length && new Set(ids).size === ids.length && ids.every((id) => c.order.includes(id));
		if (!same) throw new CollectionError('bad_order');
		const next = { ...c, order: [...ids], updatedAt: stamp() };
		await tx.store.put(next);
		await tx.done;
		return next;
	}

	/**
	 * Saves the order the person gave the collections on the Library: `ids[0]` is first.
	 * `ids` must be exactly the stored collections. Does not touch `updatedAt`
	 * (a reorder is not a change to the collection).
	 */
	async setCollectionRanks(ids: string[]): Promise<void> {
		const tx = this.db.transaction('collections', 'readwrite');
		const all = await tx.store.getAll();
		const same = ids.length === all.length && new Set(ids).size === ids.length && all.every((c) => ids.includes(c.id));
		if (!same) throw new CollectionError('bad_order');
		await Promise.all(ids.map((id, rank) => tx.store.put({ ...all.find((c) => c.id === id)!, rank })));
		await tx.done;
	}

	/** Everything on the device, ready to be written to a file. */
	async exportAll(): Promise<Backup> {
		const tx = this.db.transaction(['videos', 'collections']);
		const [videos, collections] = await Promise.all([tx.objectStore('videos').getAll(), tx.objectStore('collections').getAll()]);
		await tx.done;
		return buildBackup(videos, collections, new Date().toISOString());
	}

	/** Adds what is new from `backup` in one transaction; what is already here is never changed. */
	async importBackup(backup: Backup): Promise<ImportSummary> {
		const tx = this.db.transaction(['videos', 'collections'], 'readwrite');
		const videos = tx.objectStore('videos');
		const collections = tx.objectStore('collections');
		const plan = planImport(await videos.getAll(), await collections.getAll(), backup);
		await Promise.all([...plan.videos.map((v) => videos.put(v)), ...plan.collections.map((c) => collections.put(c))]);
		await tx.done;
		return plan.summary;
	}

	close() {
		this.db.close();
	}
}

// The user's library lives on the device (ADR-0001). Schema: ARCHITECTURE §5.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Embed, Kind, Source } from '#lib/providers/parse.ts';

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
	positionSec?: number;
	lastOpenedAt?: string;
	createdAt: string;
	updatedAt: string;
}

interface OctaDB extends DBSchema {
	videos: {
		key: string;
		value: Video;
		indexes: { canonicalUrl: string; createdAt: string };
	};
}

export const DB_NAME = 'octa';
const DB_VERSION = 1;

export class Library {
	private constructor(private db: IDBPDatabase<OctaDB>) {}

	static async open(name = DB_NAME): Promise<Library> {
		const db = await openDB<OctaDB>(name, DB_VERSION, {
			upgrade(db) {
				const videos = db.createObjectStore('videos', { keyPath: 'id' });
				videos.createIndex('canonicalUrl', 'canonicalUrl', { unique: true });
				videos.createIndex('createdAt', 'createdAt');
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

	close() {
		this.db.close();
	}
}

// Export / import of the whole library as one JSON file (ARCHITECTURE §5). Pure: the page and
// the Library class do the reading and writing. The file is hostile input (it can come from
// anywhere), so import validates every field and rebuilds what must not be trusted.
import type { Collection, Health, Video } from '#lib/db/library.ts';
import { newId } from '#lib/id.ts';
import { parseLink } from '#lib/providers/parse.ts';

export const BACKUP_APP = 'octa';
export const BACKUP_SCHEMA = 1;
export const BACKUP_MAX_BYTES = 10 * 1024 * 1024;

const MAX_VIDEOS = 20_000;
const MAX_COLLECTIONS = 2_000;
const MAX_TEXT = 500;
const MAX_ID = 100;
const NAME_MAX = 60;
const HEALTH: Health[] = ['alive', 'dead', 'restricted', 'unknown'];
const RESERVED = new Set(['todos', 'assistidos', 'favoritos']);

export interface Backup {
	app: typeof BACKUP_APP;
	schema: number;
	exportedAt: string;
	videos: Video[];
	collections: Collection[];
}

export type BackupError = 'not_json' | 'not_octa' | 'newer_schema' | 'too_big';

export type ParsedBackup = { ok: true; backup: Backup; dropped: number } | { ok: false; error: BackupError };

export interface ImportSummary {
	addedVideos: number;
	skippedVideos: number;
	addedCollections: number;
	mergedCollections: number;
}

export interface ImportPlan {
	/** Videos to add. */
	videos: Video[];
	/** Collections to add or to replace (merged ones come with their new order). */
	collections: Collection[];
	summary: ImportSummary;
}

export function buildBackup(videos: Video[], collections: Collection[], exportedAt: string): Backup {
	return { app: BACKUP_APP, schema: BACKUP_SCHEMA, exportedAt, videos, collections };
}

export function backupFileName(now = new Date()): string {
	return `octa-${now.toISOString().slice(0, 10)}.json`;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number): string | undefined =>
	typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max) : undefined;
const isoOr = (v: unknown, fallback: string): string => {
	const s = str(v, 40);
	return s && !Number.isNaN(Date.parse(s)) ? s : fallback;
};
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);

function httpsUrl(v: unknown): string | undefined {
	const s = str(v, 2048);
	if (!s) return undefined;
	try {
		return new URL(s).protocol === 'https:' ? s : undefined;
	} catch {
		return undefined;
	}
}

function cleanVideo(raw: unknown, now: string): Video | undefined {
	if (!isObj(raw)) return undefined;
	const id = str(raw.id, MAX_ID)?.trim();
	const link = str(raw.url, 2048) ?? str(raw.canonicalUrl, 2048);
	if (!id || !link) return undefined;
	let ref;
	try {
		// Source, kind, canonical link and embed come from our own parser, never from the file.
		ref = parseLink(str(raw.canonicalUrl, 2048) ?? link);
	} catch {
		return undefined;
	}
	const created = isoOr(raw.createdAt, now);
	const video: Video = {
		id,
		url: httpsUrl(raw.url) ?? ref.canonicalUrl,
		canonicalUrl: ref.canonicalUrl,
		source: ref.source,
		kind: ref.kind,
		embed: ref.embed,
		title: str(raw.title, MAX_TEXT)?.trim() || ref.title || ref.canonicalUrl,
		health: HEALTH.includes(raw.health as Health) ? (raw.health as Health) : 'unknown',
		deadStreak: Math.floor(num(raw.deadStreak) ?? 0),
		favorite: raw.favorite === true,
		createdAt: created,
		updatedAt: isoOr(raw.updatedAt, created)
	};
	const author = str(raw.author, MAX_TEXT)?.trim();
	if (author) video.author = author;
	const thumbnail = httpsUrl(raw.thumbnail);
	if (thumbnail) video.thumbnail = thumbnail;
	const durationSec = num(raw.durationSec);
	if (durationSec !== undefined) video.durationSec = durationSec;
	if (raw.watched === true) video.watched = true;
	const positionSec = num(raw.positionSec);
	if (positionSec !== undefined) video.positionSec = positionSec;
	if (typeof raw.checkedAt === 'string') video.checkedAt = isoOr(raw.checkedAt, now);
	if (typeof raw.metaAt === 'string') video.metaAt = isoOr(raw.metaAt, now);
	if (typeof raw.lastOpenedAt === 'string') video.lastOpenedAt = isoOr(raw.lastOpenedAt, now);
	return video;
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Reads a backup file's text. Anything wrong with a single item drops that item, not the file. */
export function parseBackup(text: string, now = new Date().toISOString()): ParsedBackup {
	if (text.length > BACKUP_MAX_BYTES) return { ok: false, error: 'too_big' };
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		return { ok: false, error: 'not_json' };
	}
	if (!isObj(data) || data.app !== BACKUP_APP || typeof data.schema !== 'number' || !Array.isArray(data.videos) || !Array.isArray(data.collections)) {
		return { ok: false, error: 'not_octa' };
	}
	if (data.schema > BACKUP_SCHEMA) return { ok: false, error: 'newer_schema' };

	let dropped = 0;
	const videos: Video[] = [];
	const ids = new Set<string>();
	const links = new Set<string>();
	for (const raw of data.videos.slice(0, MAX_VIDEOS)) {
		const v = cleanVideo(raw, now);
		if (!v || ids.has(v.id) || links.has(v.canonicalUrl)) {
			dropped++;
			continue;
		}
		ids.add(v.id);
		links.add(v.canonicalUrl);
		videos.push(v);
	}

	const collections: Collection[] = [];
	const placed = new Set<string>();
	const seen = new Set<string>();
	for (const raw of data.collections.slice(0, MAX_COLLECTIONS)) {
		if (!isObj(raw)) continue;
		const id = str(raw.id, MAX_ID)?.trim();
		const name = str(raw.name, 200)?.replace(/\s+/g, ' ').trim();
		if (!id || seen.has(id) || !name || name.length > NAME_MAX || RESERVED.has(fold(name))) continue;
		seen.add(id);
		const order: string[] = [];
		for (const vid of Array.isArray(raw.order) ? raw.order : []) {
			if (typeof vid === 'string' && ids.has(vid) && !placed.has(vid)) {
				placed.add(vid);
				order.push(vid);
			}
		}
		const created = isoOr(raw.createdAt, now);
		const c: Collection = { id, name, order, createdAt: created, updatedAt: isoOr(raw.updatedAt, created) };
		const rank = num(raw.rank);
		if (rank !== undefined) c.rank = Math.floor(rank);
		collections.push(c);
	}

	return { ok: true, dropped, backup: buildBackup(videos, collections, isoOr(data.exportedAt, now)) };
}

/**
 * What importing `backup` into the current library would add. The existing library wins every
 * conflict: a link already saved is skipped, a collection with the same id keeps its name and
 * rank and only receives the new videos. Importing the same file twice adds nothing.
 */
export function planImport(haveVideos: readonly Video[], haveCollections: readonly Collection[], backup: Backup): ImportPlan {
	const byLink = new Map(haveVideos.map((v) => [v.canonicalUrl, v.id]));
	const usedIds = new Set(haveVideos.map((v) => v.id));
	const inCollection = new Set(haveCollections.flatMap((c) => c.order));
	const idMap = new Map<string, string>(); // incoming id -> id in the library
	const added: Video[] = [];
	let skipped = 0;

	for (const v of backup.videos) {
		const existing = byLink.get(v.canonicalUrl);
		if (existing) {
			idMap.set(v.id, existing);
			skipped++;
			continue;
		}
		let id = v.id;
		while (usedIds.has(id)) id = newId();
		usedIds.add(id);
		byLink.set(v.canonicalUrl, id);
		idMap.set(v.id, id);
		added.push(id === v.id ? v : { ...v, id });
	}

	const have = new Map(haveCollections.map((c) => [c.id, c]));
	const ranked = haveCollections.filter((c) => c.rank !== undefined);
	const baseRank = ranked.length ? Math.max(...ranked.map((c) => c.rank!)) + 1 : 0;
	const incomingRanks = [...new Set(backup.collections.filter((c) => c.rank !== undefined && !have.has(c.id)).map((c) => c.rank!))].sort((a, b) => a - b);

	const out: Collection[] = [];
	let addedCollections = 0;
	let mergedCollections = 0;
	for (const c of backup.collections) {
		const order: string[] = [];
		for (const vid of c.order) {
			const id = idMap.get(vid);
			if (id && !inCollection.has(id)) {
				inCollection.add(id);
				order.push(id);
			}
		}
		const mine = have.get(c.id);
		if (mine) {
			if (order.length) {
				out.push({ ...mine, order: [...mine.order, ...order] });
				mergedCollections++;
			}
			continue;
		}
		const next: Collection = { ...c, order };
		if (c.rank !== undefined) next.rank = baseRank + incomingRanks.indexOf(c.rank);
		out.push(next);
		addedCollections++;
	}

	return { videos: added, collections: out, summary: { addedVideos: added.length, skippedVideos: skipped, addedCollections, mergedCollections } };
}

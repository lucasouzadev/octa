// Paste → video. The client parser decides identity (canonical URL, embed);
// the API only adds metadata and health, so a hostile or broken API response
// can never point the player somewhere else.
import { LinkError, parseLink, type Ref } from '#lib/providers/parse.ts';
import type { Library, Video } from '#lib/db/library.ts';
import { resolveLink, type Meta } from '#lib/api.ts';
import { newId } from '#lib/id.ts';

export { newId };

const RESOLVE_TIMEOUT_MS = 4000;
// A TikTok short link cannot be saved without the API (only it can follow the redirect), so
// the person is waiting on it: allow for a free-tier API that is waking up from sleep.
export const EXPAND_TIMEOUT_MS = 20_000;

// TikTok's public oEmbed sends no title, author or cover (checked 2026-11-20): the API answers
// with this generic title, and the client builds a better one from the @handle in the URL.
export const GENERIC_TIKTOK_TITLE = 'Vídeo do TikTok';
const TT_HANDLE_RE = /^https:\/\/www\.tiktok\.com\/(@[^/?#]+)\/video\/\d+$/;

export function tiktokHandle(canonicalUrl: string): string | undefined {
	return TT_HANDLE_RE.exec(canonicalUrl)?.[1];
}

export interface AddDeps {
	library: Library;
	resolve?: (url: string, signal: AbortSignal) => Promise<Meta>;
	expandTimeoutMs?: number;
}

const TIKTOK_SHORT = /^(?:https?:\/\/)?(?:vm|vt)\.tiktok\.com\//i;

/**
 * parseLink, plus one case the client cannot do alone: a TikTok short link only turns
 * into /@user/video/ID through a redirect, which the API follows. The API's answer is
 * never trusted for identity: its canonical URL goes back through parseLink and must
 * be a TikTok video.
 */
async function parseOrExpand(
	raw: string,
	resolve: (url: string, signal: AbortSignal) => Promise<Meta>,
	expandTimeoutMs: number
): Promise<{ ref: Ref; meta: Meta | null }> {
	try {
		return { ref: parseLink(raw), meta: null };
	} catch (e) {
		if (!(e instanceof LinkError) || e.code !== 'unsupported_url' || !TIKTOK_SHORT.test(raw.trim())) throw e;
		const meta = await tryResolve(raw, resolve, expandTimeoutMs);
		// Offline, timeout, 5xx or a wrong API base: not the same as "TikTok link we do not support".
		if (!meta) throw new LinkError('resolver_unavailable');
		try {
			const ref = parseLink(meta.canonicalUrl);
			if (ref.source === 'tiktok') return { ref, meta };
		} catch {
			// fall through to the original error
		}
		throw e;
	}
}

export async function addLink(raw: string, deps: AddDeps): Promise<{ video: Video; created: boolean }> {
	const resolve = deps.resolve ?? ((u, signal) => resolveLink(u, { signal }));
	const { ref, meta: expanded } = await parseOrExpand(raw, resolve, deps.expandTimeoutMs ?? EXPAND_TIMEOUT_MS); // throws LinkError before anything is saved
	const existing = await deps.library.findByCanonical(ref.canonicalUrl);
	if (existing) return { video: existing, created: false };

	const now = new Date().toISOString();
	const video: Video = {
		id: newId(),
		url: raw.trim(),
		canonicalUrl: ref.canonicalUrl,
		source: ref.source,
		kind: ref.kind,
		embed: ref.embed,
		title: fallbackTitle(ref),
		author: fallbackAuthor(ref),
		thumbnail: fallbackThumb(ref),
		health: 'unknown',
		deadStreak: 0,
		favorite: false,
		createdAt: now,
		updatedAt: now
	};

	const meta = expanded ?? (await tryResolve(raw, resolve));
	if (meta) {
		Object.assign(video, metaPatch(meta));
	}
	try {
		return { video: await deps.library.put(video), created: true };
	} catch (e) {
		// A second paste of the same link finished first: the unique canonicalUrl
		// index rejected ours. Hand back the winner instead of failing.
		if ((e as { name?: string } | null)?.name === 'ConstraintError') {
			const winner = await deps.library.findByCanonical(ref.canonicalUrl);
			if (winner) return { video: winner, created: false };
		}
		throw e;
	}
}

/**
 * The fields a trusted-but-sanitised API answer may set. Identity (canonical URL,
 * embed) never comes from here: the client parser owns it.
 */
export function metaPatch(meta: Meta): Partial<Video> {
	const patch: Partial<Video> = { health: meta.health, checkedAt: meta.checkedAt, metaAt: meta.checkedAt };
	const title = text(meta.title, 300);
	// Never let the API's generic TikTok title replace the handle title.
	if (title && !(meta.source === 'tiktok' && title === GENERIC_TIKTOK_TITLE)) patch.title = title;
	const author = text(meta.author, 120);
	if (author) patch.author = author;
	if (meta.thumbnail && /^https:\/\//.test(meta.thumbnail)) patch.thumbnail = meta.thumbnail;
	if (typeof meta.durationSec === 'number') patch.durationSec = meta.durationSec;
	return patch;
}

export async function tryResolve(
	raw: string,
	resolve: (url: string, signal: AbortSignal) => Promise<Meta>,
	timeoutMs = RESOLVE_TIMEOUT_MS
): Promise<Meta | null> {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		return await resolve(raw, ctrl.signal);
	} catch (e) {
		if (e instanceof LinkError) throw e; // API and parser disagree: trust the stricter one
		return null; // offline, timeout, 5xx: keep the parser result
	} finally {
		clearTimeout(timer);
	}
}

/** The parser's stand-in titles: a video that still has one has not been described by the API. */
const GENERIC_TITLES = new Set(['Vídeo do YouTube', 'Reel do Instagram', 'Vídeo do Instagram', 'Vídeo']);
export const hasGenericTitle = (v: Pick<Video, 'title' | 'source'>): boolean => v.source !== 'tiktok' && GENERIC_TITLES.has(v.title);

function fallbackTitle(ref: Ref): string {
	if (ref.title) return ref.title;
	switch (ref.source) {
		case 'youtube':
			return 'Vídeo do YouTube';
		case 'instagram':
			return ref.kind === 'reel' ? 'Reel do Instagram' : 'Vídeo do Instagram';
		case 'tiktok': {
			const handle = tiktokHandle(ref.canonicalUrl);
			return handle ? `Vídeo de ${handle}` : GENERIC_TIKTOK_TITLE;
		}
		default:
			return 'Vídeo';
	}
}

function fallbackAuthor(ref: Ref): string | undefined {
	return ref.source === 'tiktok' ? tiktokHandle(ref.canonicalUrl) : undefined;
}

/**
 * TikToks saved before the handle title existed keep the generic title. Give them the
 * handle title, but never touch a title the person edited. Returns how many changed.
 */
export async function upgradeGenericTitles(library: Library): Promise<number> {
	let done = 0;
	for (const video of await library.list()) {
		if (video.source !== 'tiktok' || video.title !== GENERIC_TIKTOK_TITLE) continue;
		const handle = tiktokHandle(video.canonicalUrl);
		if (!handle) continue;
		await library.update(video.id, { title: `Vídeo de ${handle}`, author: video.author ?? handle });
		done++;
	}
	return done;
}

function fallbackThumb(ref: Ref): string | undefined {
	return ref.source === 'youtube' ? `https://i.ytimg.com/vi/${ref.id}/hqdefault.jpg` : undefined;
}

function text(v: unknown, max: number): string {
	if (typeof v !== 'string') return '';
	const s = v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
	return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

export class EditError extends Error {
	constructor(public code: 'empty_title' | 'title_too_long' | 'duplicate' | 'not_found') {
		super(code);
		this.name = 'EditError';
	}
}

/**
 * Corrects a saved video: a new title, a new link, or both. A new link goes through the
 * same parser and metadata path as a paste, resets health and position, and keeps the
 * video's id, likes, watched mark and collection.
 */
export async function editVideo(
	id: string,
	changes: { title?: string; url?: string },
	deps: AddDeps
): Promise<Video> {
	const current = await deps.library.get(id);
	if (!current) throw new EditError('not_found');

	let title: string | undefined;
	if (changes.title !== undefined) {
		title = changes.title.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
		if (!title) throw new EditError('empty_title');
		if (title.length > 300) throw new EditError('title_too_long');
	}

	const raw = changes.url?.trim();
	if (!raw || raw === current.url.trim()) {
		return title && title !== current.title ? deps.library.update(id, { title }) : current;
	}

	const resolve = deps.resolve ?? ((u, signal) => resolveLink(u, { signal }));
	const { ref, meta: expanded } = await parseOrExpand(raw, resolve, deps.expandTimeoutMs ?? EXPAND_TIMEOUT_MS); // throws LinkError before anything changes
	if (ref.canonicalUrl !== current.canonicalUrl) {
		const other = await deps.library.findByCanonical(ref.canonicalUrl);
		if (other && other.id !== id) throw new EditError('duplicate');
	}
	const patch: Partial<Video> = {
		url: raw,
		canonicalUrl: ref.canonicalUrl,
		source: ref.source,
		kind: ref.kind,
		embed: ref.embed,
		title: fallbackTitle(ref),
		thumbnail: fallbackThumb(ref),
		author: fallbackAuthor(ref),
		durationSec: undefined,
		positionSec: undefined,
		checkedAt: undefined,
		health: 'unknown',
		deadStreak: 0
	};
	const meta = expanded ?? (await tryResolve(raw, resolve));
	if (meta) Object.assign(patch, metaPatch(meta));
	if (title) patch.title = title; // what the person typed wins over the YouTube title
	try {
		return await deps.library.update(id, patch);
	} catch (e) {
		if ((e as { name?: string } | null)?.name === 'ConstraintError') throw new EditError('duplicate');
		throw e;
	}
}

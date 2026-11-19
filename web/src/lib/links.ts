// Paste → video. The client parser decides identity (canonical URL, embed);
// the API only adds metadata and health, so a hostile or broken API response
// can never point the player somewhere else.
import { LinkError, parseLink, type Ref } from '#lib/providers/parse.ts';
import type { Library, Video } from '#lib/db/library.ts';
import { resolveLink, type Meta } from '#lib/api.ts';
import { newId } from '#lib/id.ts';

export { newId };

const RESOLVE_TIMEOUT_MS = 4000;

export interface AddDeps {
	library: Library;
	resolve?: (url: string, signal: AbortSignal) => Promise<Meta>;
}

export async function addLink(raw: string, deps: AddDeps): Promise<{ video: Video; created: boolean }> {
	const ref = parseLink(raw); // throws LinkError before anything is saved or sent
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
		thumbnail: fallbackThumb(ref),
		health: 'unknown',
		deadStreak: 0,
		favorite: false,
		createdAt: now,
		updatedAt: now
	};

	const meta = await tryResolve(raw, deps.resolve ?? ((u, signal) => resolveLink(u, { signal })));
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
	const patch: Partial<Video> = { health: meta.health, checkedAt: meta.checkedAt };
	const title = text(meta.title, 300);
	if (title) patch.title = title;
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

function fallbackTitle(ref: Ref): string {
	if (ref.title) return ref.title;
	return ref.source === 'youtube' ? 'Vídeo do YouTube' : 'Vídeo';
}

function fallbackThumb(ref: Ref): string | undefined {
	return ref.source === 'youtube' ? `https://i.ytimg.com/vi/${ref.id}/hqdefault.jpg` : undefined;
}

function text(v: unknown, max: number): string {
	if (typeof v !== 'string') return '';
	const s = v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
	return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

// Paste → video. The client parser decides identity (canonical URL, embed);
// the API only adds metadata and health, so a hostile or broken API response
// can never point the player somewhere else.
import { LinkError, parseLink, type Ref } from '#lib/providers/parse.ts';
import type { Library, Video } from '#lib/db/library.ts';
import { resolveLink, type Meta } from '#lib/api.ts';

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
		video.title = text(meta.title, 300) || video.title;
		video.author = text(meta.author, 120) || undefined;
		if (meta.thumbnail && /^https:\/\//.test(meta.thumbnail)) video.thumbnail = meta.thumbnail;
		video.health = meta.health;
		video.checkedAt = meta.checkedAt;
		if (typeof meta.durationSec === 'number') video.durationSec = meta.durationSec;
	}
	return { video: await deps.library.put(video), created: true };
}

async function tryResolve(
	raw: string,
	resolve: (url: string, signal: AbortSignal) => Promise<Meta>
): Promise<Meta | null> {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), RESOLVE_TIMEOUT_MS);
	try {
		return await resolve(raw, ctrl.signal);
	} catch (e) {
		if (e instanceof LinkError) throw e; // API and parser disagree: trust the stricter one
		return null; // offline, timeout, 5xx: keep the parser result
	} finally {
		clearTimeout(timer);
	}
}

/**
 * UUID v4. `crypto.randomUUID` only exists in secure contexts, and the app is
 * also opened over plain http on the local network (phone testing), where
 * `crypto.getRandomValues` still works.
 */
export function newId(): string {
	if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
	const b = crypto.getRandomValues(new Uint8Array(16));
	b[6] = (b[6] & 0x0f) | 0x40;
	b[8] = (b[8] & 0x3f) | 0x80;
	const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
	return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
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

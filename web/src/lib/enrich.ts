// A link saved while the API was asleep (Render free cold start is ~50 s, longer
// than the 4 s paste timeout) only has the parser's generic title. This fills in
// the real metadata later, in the background, one video at a time.
import type { Library, Video } from '#lib/db/library.ts';
import { resolveLink, type Meta } from '#lib/api.ts';
import { hasGenericTitle, metaPatch, tryResolve } from '#lib/links.ts';

const COLD_START_TIMEOUT_MS = 60_000;

export interface EnrichDeps {
	resolve?: (url: string, signal: AbortSignal) => Promise<Meta>;
}

/**
 * The API never described this video: no check has ever completed, or only a health check
 * did (it sets `checkedAt`, not `metaAt`) and the title is still the parser's stand-in (R4.1).
 * Once any resolve answered, `metaAt` stops the retries even if that answer had no title.
 */
export function needsEnrich(video: Video): boolean {
	if (video.health === 'unknown' && !video.checkedAt) return true;
	return !video.metaAt && hasGenericTitle(video);
}

/**
 * Asks the API about one video and keeps what it says. Returns the saved video, or null when
 * the API is still unreachable. update() re-reads inside its transaction, so a favorite or a
 * move the person made while we waited is kept. Never throws.
 */
export async function enrichVideo(
	library: Library,
	video: Video,
	deps: EnrichDeps = {},
	timeoutMs = COLD_START_TIMEOUT_MS
): Promise<Video | null> {
	const resolve = deps.resolve ?? ((u, signal) => resolveLink(u, { signal }));
	try {
		const meta = await tryResolve(video.url, resolve, timeoutMs);
		if (!meta) return null;
		return await library.update(video.id, metaPatch(meta));
	} catch {
		return null; // API still down, link rejected, or the video was deleted meanwhile
	}
}

/** Returns how many videos were completed. Never throws: it is best-effort. */
export async function enrichPending(
	library: Library,
	deps: EnrichDeps = {},
	opts: { max?: number; timeoutMs?: number } = {}
): Promise<number> {
	const pending = (await library.list()).filter(needsEnrich).slice(0, opts.max ?? 5);
	let done = 0;
	for (const video of pending) {
		if (await enrichVideo(library, video, deps, opts.timeoutMs)) done++;
	}
	return done;
}

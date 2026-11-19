// A link saved while the API was asleep (Render free cold start is ~50 s, longer
// than the 4 s paste timeout) only has the parser's generic title. This fills in
// the real metadata later, in the background, one video at a time.
import type { Library, Video } from '#lib/db/library.ts';
import { resolveLink, type Meta } from '#lib/api.ts';
import { metaPatch, tryResolve } from '#lib/links.ts';

const COLD_START_TIMEOUT_MS = 60_000;

export interface EnrichDeps {
	resolve?: (url: string, signal: AbortSignal) => Promise<Meta>;
}

/** The API never described this video: no check has ever completed. */
export function needsEnrich(video: Video): boolean {
	return video.health === 'unknown' && !video.checkedAt;
}

/** Returns how many videos were completed. Never throws: it is best-effort. */
export async function enrichPending(
	library: Library,
	deps: EnrichDeps = {},
	opts: { max?: number; timeoutMs?: number } = {}
): Promise<number> {
	const resolve = deps.resolve ?? ((u, signal) => resolveLink(u, { signal }));
	const pending = (await library.list()).filter(needsEnrich).slice(0, opts.max ?? 5);
	let done = 0;
	for (const video of pending) {
		try {
			const meta = await tryResolve(video.url, resolve, opts.timeoutMs ?? COLD_START_TIMEOUT_MS);
			if (!meta) continue;
			// update() re-reads inside its transaction, so a favorite or a move the
			// user made while we waited is kept.
			await library.update(video.id, metaPatch(meta));
			done++;
		} catch {
			// API still down, link rejected, or the video was deleted meanwhile.
		}
	}
	return done;
}

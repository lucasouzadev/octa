// Link health on the device (SPEC §5): a sweep on app open, a check before playing,
// and the "check again" of the dead-link screen. The API only answers; every
// decision about the streak lives here so it can be tested without a network.
import type { Library, Video, Health } from '#lib/db/library.ts';
import { checkHealth } from '#lib/api.ts';

export const STALE_MS = 24 * 3_600_000;
/** Two dead answers must be this far apart to count as two. */
export const DEAD_GAP_MS = 12 * 3_600_000;
export const BATCH = 50;

export interface HealthResult {
	id: string;
	health: Health;
	checkedAt: string;
}
export type CheckFn = (
	items: { id: string; url: string }[],
	opts?: { fresh?: boolean }
) => Promise<HealthResult[]>;
export interface HealthDeps {
	check?: CheckFn;
}

const time = (iso?: string) => (iso ? Date.parse(iso) : NaN);

export function isStale(v: Pick<Video, 'checkedAt'>, now: number): boolean {
	const t = time(v.checkedAt);
	return Number.isNaN(t) || now - t >= STALE_MS;
}

type Known = Pick<Video, 'health' | 'deadStreak' | 'checkedAt'>;

/**
 * What a check changes on the video, or null when it changes nothing: an unknown
 * answer (a blocked check is not proof), or one that is not newer than what we hold
 * (the API caches, so the same answer can come back twice).
 */
export function healthPatch(v: Known, r: HealthResult): Pick<Video, 'health' | 'deadStreak' | 'checkedAt'> | null {
	if (r.health === 'unknown') return null;
	const next = time(r.checkedAt);
	const prev = time(v.checkedAt);
	if (!Number.isNaN(prev) && !(next > prev)) return null;
	if (r.health !== 'dead') return { health: r.health, deadStreak: 0, checkedAt: r.checkedAt };
	let deadStreak = 1;
	if (v.health === 'dead') {
		const held = Math.max(v.deadStreak, 1);
		deadStreak = !Number.isNaN(prev) && next - prev >= DEAD_GAP_MS ? held + 1 : held;
	}
	return { health: 'dead', deadStreak, checkedAt: r.checkedAt };
}

async function apply(library: Library, id: string, r: HealthResult): Promise<boolean> {
	const current = await library.get(id);
	if (!current) return false;
	const patch = healthPatch(current, r);
	if (!patch) return false;
	await library.update(id, patch);
	return true;
}

/** Checks every stale video in batches of 50. Best effort: never throws. Returns how many changed. */
export async function sweepHealth(
	library: Library,
	deps: HealthDeps = {},
	opts: { now?: number } = {}
): Promise<number> {
	const check = deps.check ?? checkHealth;
	const now = opts.now ?? Date.now();
	const stale = (await library.list()).filter((v) => isStale(v, now));
	let changed = 0;
	for (let i = 0; i < stale.length; i += BATCH) {
		const batch = stale.slice(i, i + BATCH);
		try {
			const results = await check(batch.map((v) => ({ id: v.id, url: v.canonicalUrl })));
			for (const r of results) if (await apply(library, r.id, r)) changed++;
		} catch {
			// API asleep or down: try again on the next open.
		}
	}
	return changed;
}

/**
 * "Keep and check again": asks the platform again (the API skips its cache) and
 * restarts the streak, so the orange screen only returns after two more dead
 * answers, one cycle apart. Never throws; the video is never deleted.
 */
export async function recheck(library: Library, video: Video, deps: HealthDeps = {}): Promise<Video> {
	const check = deps.check ?? checkHealth;
	try {
		const [r] = await check([{ id: video.id, url: video.canonicalUrl }], { fresh: true });
		if (r) await apply(library, video.id, r);
	} catch {
		// keep what we knew
	}
	return library.update(video.id, { deadStreak: 0 });
}

/** Before playing: a video not checked in the last 24 h is checked once. Never throws. */
export async function checkVideo(
	library: Library,
	video: Video,
	deps: HealthDeps = {},
	opts: { now?: number } = {}
): Promise<Video> {
	if (!isStale(video, opts.now ?? Date.now())) return video;
	const check = deps.check ?? checkHealth;
	try {
		const [r] = await check([{ id: video.id, url: video.canonicalUrl }]);
		if (r && (await apply(library, video.id, r))) return (await library.get(video.id)) ?? video;
	} catch {
		// play anyway: a failed check is not a dead link
	}
	return video;
}

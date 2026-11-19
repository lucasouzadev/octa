import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Library, type Video } from '#lib/db/library.ts';
import { addLink } from '#lib/links.ts';
import { ApiError, type Meta } from '#lib/api.ts';
import { checkVideo, healthPatch, isStale, recheck, sweepHealth, type HealthResult } from '#lib/health.ts';

const H = 3_600_000;
const T0 = Date.parse('2026-11-19T12:00:00Z');
const at = (hoursFromT0: number) => new Date(T0 + hoursFromT0 * H).toISOString();

const v = (over: Partial<Video> = {}): Video =>
	({ health: 'alive', deadStreak: 0, checkedAt: at(0), ...over }) as Video;
const res = (health: HealthResult['health'], hours: number): HealthResult => ({
	id: 'x',
	health,
	checkedAt: at(hours)
});

describe('isStale', () => {
	it('is stale when never checked or checked 24 h ago or more', () => {
		expect(isStale(v({ checkedAt: undefined }), T0)).toBe(true);
		expect(isStale(v({ checkedAt: at(-24) }), T0)).toBe(true);
		expect(isStale(v({ checkedAt: at(-23) }), T0)).toBe(false);
	});
});

describe('healthPatch', () => {
	it('alive resets the dead streak', () => {
		expect(healthPatch(v({ health: 'dead', deadStreak: 1 }), res('alive', 24))).toEqual({
			health: 'alive',
			deadStreak: 0,
			checkedAt: at(24)
		});
	});

	it('restricted is shown as such and also resets the streak', () => {
		expect(healthPatch(v({ health: 'dead', deadStreak: 2 }), res('restricted', 24))).toMatchObject({
			health: 'restricted',
			deadStreak: 0
		});
	});

	it('the first dead result marks the card with a streak of 1', () => {
		expect(healthPatch(v(), res('dead', 24))).toMatchObject({ health: 'dead', deadStreak: 1 });
	});

	it('a second dead result 12 h or more later makes the streak 2', () => {
		const first = v({ health: 'dead', deadStreak: 1, checkedAt: at(0) });
		expect(healthPatch(first, res('dead', 12))).toMatchObject({ deadStreak: 2 });
	});

	it('a second dead result less than 12 h later does not count', () => {
		const first = v({ health: 'dead', deadStreak: 1, checkedAt: at(0) });
		expect(healthPatch(first, res('dead', 11))).toMatchObject({ health: 'dead', deadStreak: 1 });
	});

	it('unknown never overwrites what we knew (a blocked check is not proof)', () => {
		expect(healthPatch(v({ health: 'dead', deadStreak: 1 }), res('unknown', 24))).toBeNull();
		expect(healthPatch(v({ health: 'alive' }), res('unknown', 24))).toBeNull();
	});

	it('a result that is not newer than the stored check is ignored (server cache)', () => {
		expect(healthPatch(v({ checkedAt: at(5) }), res('dead', 5))).toBeNull();
		expect(healthPatch(v({ checkedAt: at(5) }), res('dead', 4))).toBeNull();
	});

	it('a first real result on a never-checked video is applied', () => {
		expect(healthPatch(v({ health: 'unknown', checkedAt: undefined }), res('alive', 0))).toMatchObject({
			health: 'alive'
		});
	});
});

let lib: Library;
let n = 0;
beforeEach(async () => {
	lib = await Library.open(`health-${n++}`);
});
afterEach(() => lib.close());

const down = async (): Promise<Meta> => {
	throw new ApiError(502);
};

async function save(id: string, checkedAt: string, health: Video['health'] = 'alive') {
	const { video } = await addLink(`https://youtu.be/${id}`, { library: lib, resolve: down });
	return lib.update(video.id, { health, checkedAt });
}

describe('sweepHealth', () => {
	it('checks only stale videos, in one batch, and stores the results', async () => {
		const stale = await save('aaaaaaaaaaa', at(-30));
		await save('bbbbbbbbbbb', at(-1));
		const calls: string[][] = [];
		const done = await sweepHealth(
			lib,
			{
				check: async (items) => {
					calls.push(items.map((i) => i.id));
					return items.map((i) => ({ id: i.id, health: 'dead' as const, checkedAt: at(0) }));
				}
			},
			{ now: T0 }
		);
		expect(done).toBe(1);
		expect(calls).toEqual([[stale.id]]);
		expect(await lib.get(stale.id)).toMatchObject({ health: 'dead', deadStreak: 1, checkedAt: at(0) });
	});

	it('splits into batches of 50', async () => {
		for (let i = 0; i < 60; i++) await save(`v${String(i).padStart(10, '0')}`, at(-30));
		const sizes: number[] = [];
		await sweepHealth(
			lib,
			{
				check: async (items) => {
					sizes.push(items.length);
					return [];
				}
			},
			{ now: T0 }
		);
		expect(sizes).toEqual([50, 10]);
	});

	it('never throws when the API is down and leaves videos untouched', async () => {
		const s = await save('aaaaaaaaaaa', at(-30), 'dead');
		const done = await sweepHealth(lib, { check: down as never }, { now: T0 });
		expect(done).toBe(0);
		expect(await lib.get(s.id)).toMatchObject({ health: 'dead', checkedAt: at(-30) });
	});

	it('keeps a favorite set while the check was in flight', async () => {
		const s = await save('aaaaaaaaaaa', at(-30));
		await sweepHealth(
			lib,
			{
				check: async (items) => {
					await lib.update(s.id, { favorite: true });
					return items.map((i) => ({ id: i.id, health: 'alive' as const, checkedAt: at(0) }));
				}
			},
			{ now: T0 }
		);
		expect(await lib.get(s.id)).toMatchObject({ favorite: true, checkedAt: at(0) });
	});
});

describe('recheck', () => {
	it('asks fresh, and an alive answer clears the dead mark', async () => {
		const s = await save('aaaaaaaaaaa', at(-30), 'dead');
		let fresh: boolean | undefined;
		const out = await recheck(lib, s, {
			check: async (items, opts) => {
				fresh = opts?.fresh;
				return items.map((i) => ({ id: i.id, health: 'alive' as const, checkedAt: at(0) }));
			}
		});
		expect(fresh).toBe(true);
		expect(out).toMatchObject({ health: 'alive', deadStreak: 0 });
	});

	it('still dead: stays dead but the streak restarts so the screen waits for the next cycle', async () => {
		const s = await save('aaaaaaaaaaa', at(-30), 'dead');
		await lib.update(s.id, { deadStreak: 2 });
		const out = await recheck(lib, (await lib.get(s.id))!, {
			check: async (items) => items.map((i) => ({ id: i.id, health: 'dead' as const, checkedAt: at(0) }))
		});
		expect(out).toMatchObject({ health: 'dead', deadStreak: 0 });
	});

	it('API down: keeps the video as it was, with the streak restarted', async () => {
		const s = await save('aaaaaaaaaaa', at(-30), 'dead');
		await lib.update(s.id, { deadStreak: 2 });
		const out = await recheck(lib, (await lib.get(s.id))!, { check: down as never });
		expect(out).toMatchObject({ health: 'dead', deadStreak: 0 });
	});
});

describe('checkVideo', () => {
	it('skips a video checked less than 24 h ago', async () => {
		const s = await save('aaaaaaaaaaa', at(-1));
		let calls = 0;
		const out = await checkVideo(lib, s, { check: async () => (calls++, []) }, { now: T0 });
		expect(calls).toBe(0);
		expect(out).toBe(s);
	});

	it('checks a stale video once and returns the updated one', async () => {
		const s = await save('aaaaaaaaaaa', at(-30));
		const out = await checkVideo(
			lib,
			s,
			{ check: async (items) => items.map((i) => ({ id: i.id, health: 'dead' as const, checkedAt: at(0) })) },
			{ now: T0 }
		);
		expect(out).toMatchObject({ health: 'dead', deadStreak: 1 });
	});

	it('returns the video untouched when the API is down', async () => {
		const s = await save('aaaaaaaaaaa', at(-30));
		expect(await checkVideo(lib, s, { check: down as never }, { now: T0 })).toBe(s);
	});
});

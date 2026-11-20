import { describe, expect, it } from 'vitest';
import { createTilt, TILT_RANGE_DEG } from './tilt.ts';

// The phone's own tilt drives the 3D objects the way the mouse does on a desktop.
// Pure math here; the sensor, the permission and the switch are in tilt.svelte.ts.
describe('createTilt', () => {
	it('starts at rest: the first reading is the zero pose', () => {
		const t = createTilt();
		expect(t.feed(40, 5)).toEqual({ x: 0, y: 0 });
	});

	it('leaning right moves x up to 1, leaning toward you moves y, both relative to the start', () => {
		const t = createTilt({ smoothing: 1, recenter: 0 });
		t.feed(40, 0);
		const r = t.feed(40 + TILT_RANGE_DEG / 2, TILT_RANGE_DEG / 2);
		expect(r.x).toBeCloseTo(0.5, 5);
		expect(r.y).toBeCloseTo(0.5, 5);
	});

	it('is clamped to -1..1 however far the phone goes', () => {
		const t = createTilt({ smoothing: 1, recenter: 0 });
		t.feed(0, 0);
		expect(t.feed(170, 80)).toEqual({ x: 1, y: 1 });
		expect(t.feed(-170, -80)).toEqual({ x: -1, y: -1 });
	});

	it('ignores hand tremor under the dead zone', () => {
		const t = createTilt({ smoothing: 1, recenter: 0 });
		t.feed(30, 0);
		expect(t.feed(30.8, 0.8)).toEqual({ x: 0, y: 0 });
	});

	it('smooths: one jump does not snap the pose', () => {
		const t = createTilt({ smoothing: 0.2, recenter: 0 });
		t.feed(0, 0);
		const r = t.feed(0, TILT_RANGE_DEG);
		expect(r.x).toBeGreaterThan(0);
		expect(r.x).toBeLessThan(0.3);
	});

	it('holding the phone at a new angle slowly becomes the new rest pose', () => {
		const t = createTilt({ smoothing: 1, recenter: 0.1 });
		t.feed(0, 0);
		let last = t.feed(0, 10);
		for (let i = 0; i < 80; i++) last = t.feed(0, 10);
		expect(Math.abs(last.x)).toBeLessThan(0.02);
	});

	it('skips readings the sensor could not give (null) and keeps the last pose', () => {
		const t = createTilt({ smoothing: 1, recenter: 0 });
		t.feed(0, 0);
		const a = t.feed(0, 10);
		expect(t.feed(null, null)).toEqual(a);
	});

	it('reset forgets the rest pose', () => {
		const t = createTilt({ smoothing: 1, recenter: 0 });
		t.feed(0, 0);
		t.feed(0, 15);
		t.reset();
		expect(t.feed(90, 90)).toEqual({ x: 0, y: 0 });
	});
});

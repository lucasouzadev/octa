import { describe, expect, it } from 'vitest';
import { monitorPose, stepSpring, visibleIndexes } from './monitor.ts';

const deg = (r: number) => (r * 180) / Math.PI;

describe('monitorPose', () => {
	it('starts from the same cycle of poses as the CSS monitors', () => {
		const p = monitorPose(0, 400, 800, { x: 0, y: 0 });
		expect(deg(p.rotZ)).toBeCloseTo(2, 5); // CSS rotZ -2deg is clockwise-negative; three is counter-clockwise
		expect(deg(p.rotY)).toBeCloseTo(-6, 5);
	});

	it('leans back at the top of the screen and forward at the bottom (scroll tilt)', () => {
		const top = monitorPose(1, 100, 800, { x: 0, y: 0 });
		const mid = monitorPose(1, 400, 800, { x: 0, y: 0 });
		const bottom = monitorPose(1, 700, 800, { x: 0, y: 0 });
		expect(top.rotX).toBeLessThan(mid.rotX);
		expect(mid.rotX).toBeLessThan(bottom.rotX);
	});

	it('keeps the scroll tilt small enough to read the title', () => {
		for (const y of [-2000, 0, 400, 800, 5000]) {
			expect(Math.abs(deg(monitorPose(2, y, 800, { x: 0, y: 0 }).rotX))).toBeLessThanOrEqual(14);
		}
	});

	it('follows the pointer on top of the base pose', () => {
		const rest = monitorPose(2, 400, 800, { x: 0, y: 0 });
		const right = monitorPose(2, 400, 800, { x: 1, y: 0 });
		const down = monitorPose(2, 400, 800, { x: 0, y: 1 });
		expect(right.rotY).not.toBe(rest.rotY);
		expect(down.rotX).not.toBe(rest.rotX);
	});

	it('clamps a wild pointer', () => {
		const a = monitorPose(0, 400, 800, { x: 1, y: 1 });
		const b = monitorPose(0, 400, 800, { x: 50, y: -50 });
		expect(Math.abs(b.rotY - a.rotY)).toBeLessThan(0.5);
		expect(Number.isFinite(b.rotX)).toBe(true);
	});
});

describe('stepSpring', () => {
	it('moves toward the target and settles on it', () => {
		let s = { pos: 0, vel: 0 };
		for (let i = 0; i < 200; i++) s = stepSpring(s, 1);
		expect(s.pos).toBe(1);
		expect(s.vel).toBe(0);
	});

	it('is at rest when already on target', () => {
		expect(stepSpring({ pos: 0.5, vel: 0 }, 0.5)).toEqual({ pos: 0.5, vel: 0 });
	});
});

describe('visibleIndexes', () => {
	const rects = [
		{ top: -900, height: 300 },
		{ top: -200, height: 300 },
		{ top: 300, height: 300 },
		{ top: 1000, height: 300 },
		{ top: 3000, height: 300 }
	];

	it('keeps rows on screen plus a margin, nothing far away', () => {
		expect(visibleIndexes(rects, 800, 200)).toEqual([1, 2, 3]);
	});

	it('returns nothing for no rows', () => {
		expect(visibleIndexes([], 800, 200)).toEqual([]);
	});
});

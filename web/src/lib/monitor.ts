// Pose and motion of the WebGL monitors on the Collection screen (slice 2e-3).
// Pure functions in three.js conventions (radians, +x right, +y up, +z toward the
// viewer; positive rotation.z is counter-clockwise). The base poses are the CSS
// monitors' own (lib/shelf.ts), so both renderers show the same pile.
import { screenTilt } from './shelf.ts';

const rad = (d: number) => (d * Math.PI) / 180;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export interface Pose {
	rotX: number;
	rotY: number;
	rotZ: number;
}

/**
 * @param index     position of the monitor in the pile (picks one of the base poses)
 * @param centerY   vertical centre of the row in viewport px
 * @param viewportH viewport height in px
 * @param pointer   pointer over this monitor, -1..1 on both axes (0,0 = at rest)
 */
export function monitorPose(
	index: number,
	centerY: number,
	viewportH: number,
	pointer: { x: number; y: number }
): Pose {
	const base = screenTilt(index);
	// Scroll tilt: monitors lean back near the top and forward near the bottom.
	const t = clamp((centerY - viewportH / 2) / (viewportH / 2), -1, 1);
	const px = clamp(pointer.x, -1, 1);
	const py = clamp(pointer.y, -1, 1);
	return {
		rotX: -rad(6) + t * rad(7) + py * -0.12,
		rotY: -rad(base.rotY) + px * 0.2,
		rotZ: -rad(base.rotZ)
	};
}

export interface Spring {
	pos: number;
	vel: number;
}

const STIFFNESS = 0.15;
const DAMPING = 0.8;

/** One frame of the tilt spring; snaps to the target once it is close enough to stop drawing. */
export function stepSpring(s: Spring, target: number): Spring {
	const vel = (s.vel + (target - s.pos) * STIFFNESS) * DAMPING;
	const pos = s.pos + vel;
	if (Math.abs(target - pos) <= 0.002 && Math.abs(vel) <= 0.002) return { pos: target, vel: 0 };
	return { pos, vel };
}

/** Indexes of the rows worth drawing: on screen, plus `margin` px above and below. */
export function visibleIndexes(rows: { top: number; height: number }[], viewportH: number, margin: number): number[] {
	const out: number[] = [];
	rows.forEach((r, i) => {
		if (r.top + r.height >= -margin && r.top <= viewportH + margin) out.push(i);
	});
	return out;
}

// Device tilt as a pose in -1..1 on both axes (0,0 = at rest), the same range the mouse
// gives the 3D objects. Pure: the sensor, permission and switch live in tilt.svelte.ts.

/** Degrees of lean that count as full tilt (1). */
export const TILT_RANGE_DEG = 22;
const DEAD_ZONE_DEG = 1;

export interface TiltOptions {
	/** 0..1 share of the distance covered per reading (1 = no smoothing). */
	smoothing?: number;
	/** 0..1 share per reading that the rest pose follows the phone (0 = never). */
	recenter?: number;
}

const clamp = (n: number) => Math.max(-1, Math.min(1, n));

export function createTilt({ smoothing = 0.18, recenter = 0.006 }: TiltOptions = {}) {
	let base: { beta: number; gamma: number } | null = null;
	let pose = { x: 0, y: 0 };

	return {
		/**
		 * @param beta  front-back tilt in degrees (DeviceOrientationEvent.beta)
		 * @param gamma left-right tilt in degrees (DeviceOrientationEvent.gamma)
		 */
		feed(beta: number | null, gamma: number | null): { x: number; y: number } {
			if (beta === null || gamma === null || !Number.isFinite(beta) || !Number.isFinite(gamma)) return pose;
			if (!base) {
				base = { beta, gamma };
				return pose;
			}
			const dx = gamma - base.gamma;
			const dy = beta - base.beta;
			const target = {
				x: Math.abs(dx) < DEAD_ZONE_DEG ? 0 : clamp(dx / TILT_RANGE_DEG),
				y: Math.abs(dy) < DEAD_ZONE_DEG ? 0 : clamp(dy / TILT_RANGE_DEG)
			};
			pose = { x: pose.x + (target.x - pose.x) * smoothing, y: pose.y + (target.y - pose.y) * smoothing };
			// The rest pose drifts toward where the phone is held, so a new posture settles at zero.
			base = { beta: base.beta + dy * recenter, gamma: base.gamma + dx * recenter };
			return pose;
		},
		reset() {
			base = null;
			pose = { x: 0, y: 0 };
		}
	};
}

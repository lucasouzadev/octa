// Parameters of the hearts that rise when a video is liked. Pure and seeded so it can be
// tested; HeartBurst.svelte only draws what this says.
export interface Heart {
	/** Sideways drift at the top of the rise, in px (negative is left). */
	dx: number;
	/** Wait before this heart starts, in ms. */
	delay: number;
	/** Size in px. */
	size: number;
	/** Time to rise and fade, in ms. */
	duration: number;
	/** Final tilt in degrees. */
	rotate: number;
}

// Small deterministic generator (mulberry32).
function rng(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function heartBurst(count = 9, seed = 1): Heart[] {
	const next = rng(seed * 2654435761);
	const between = (lo: number, hi: number) => lo + next() * (hi - lo);
	return Array.from({ length: Math.max(0, count) }, (_, i) => {
		// Alternate sides so the burst fans out both ways, then jitter each heart.
		const side = i % 2 === 0 ? -1 : 1;
		return {
			dx: Math.round(side * between(6, 60)),
			delay: Math.round(between(0, 300)),
			size: Math.round(between(14, 30)),
			duration: Math.round(between(900, 1500)),
			rotate: Math.round(between(-28, 28))
		};
	});
}

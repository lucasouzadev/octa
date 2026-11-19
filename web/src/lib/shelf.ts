// Content and pose of the "screens" on the Collection screen (prototype page 3).
// Pure functions: the renderer (CSS-3D now, WebGL later) only draws what these say.
import type { Health } from './db/library.ts';

/** "12:25", "1:05", "1:02:03"; undefined when the length is unknown or not a number. */
export function formatDuration(sec: number | undefined): string | undefined {
	if (sec === undefined || !Number.isFinite(sec) || sec <= 0) return undefined;
	const total = Math.floor(sec);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const ss = String(s).padStart(2, '0');
	return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export interface Status {
	label: string;
	tone: 'ok' | 'dead';
}

/** What the screen says about the link. A link nobody checked yet says nothing. */
export function statusOf(health: Health): Status | undefined {
	switch (health) {
		case 'alive':
			return { label: 'Ativo', tone: 'ok' };
		case 'dead':
			return { label: 'Fora do ar', tone: 'dead' };
		case 'restricted':
			return { label: 'Restrito', tone: 'dead' };
		default:
			return undefined;
	}
}

/** "16 vídeos · 1 fora do ar". Only links known to be dead are counted as out of the air. */
export function shelfSummary(videos: { health: Health }[]): string {
	const n = videos.length;
	const base = n === 1 ? '1 vídeo' : `${n} vídeos`;
	const dead = videos.filter((v) => v.health === 'dead').length;
	return dead > 0 ? `${base} · ${dead} fora do ar` : base;
}

export interface ScreenTilt {
	/** Degrees around the screen's normal (CSS convention, clockwise positive). */
	rotZ: number;
	/** Degrees around the vertical axis: the right edge comes toward the viewer when positive. */
	rotY: number;
	/** Sideways nudge in % of the card's width, so the pile looks hand-placed. */
	shiftX: number;
}

// Four poses cycle; neighbours always lean opposite ways and none of them repeats
// back to back. Small angles: the title has to stay readable.
const POSES: ScreenTilt[] = [
	{ rotZ: -2, rotY: 6, shiftX: -2 },
	{ rotZ: 1.5, rotY: -5, shiftX: 3 },
	{ rotZ: -1, rotY: 4, shiftX: 1 },
	{ rotZ: 2.5, rotY: -7, shiftX: -3 }
];

export function screenTilt(index: number): ScreenTilt {
	return POSES[((index % POSES.length) + POSES.length) % POSES.length];
}

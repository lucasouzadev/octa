// The "cinema" player (slice 3c): one control bar of ours for every source. These are
// the pure pieces; adapters.ts talks to the real players.

export type Phase = 'idle' | 'playing' | 'paused' | 'buffering' | 'ended';

/** 0:00, 1:05, 1:02:03. Anything that is not a positive number reads 0:00. */
export function clock(sec: number): string {
	if (!Number.isFinite(sec) || sec <= 0) return '0:00';
	const t = Math.floor(sec);
	const h = Math.floor(t / 3600);
	const m = Math.floor((t % 3600) / 60);
	const s = String(t % 60).padStart(2, '0');
	return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** The start= offset of an embed URL, in seconds. */
export function startOf(src: string): number {
	try {
		const n = Number(new URL(src).searchParams.get('start'));
		return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
	} catch {
		return 0;
	}
}

/** Below this a resume is not worth it; within it of the end the video counts as finished. */
const RESUME_MIN = 10;

/** Where to start a video the person left earlier: 0 = from the beginning. */
export function resumeAt(position?: number, duration?: number): number {
	if (position === undefined || !Number.isFinite(position) || position < RESUME_MIN) return 0;
	if (duration && Number.isFinite(duration) && position >= duration - RESUME_MIN) return 0;
	return Math.floor(position);
}

/** Progress is written at most every 5 s (IndexedDB writes are cheap, not free). */
export function shouldSave(lastSaved: number, time: number): boolean {
	return Number.isFinite(time) && Math.abs(time - lastSaved) >= 5;
}

/** YouTube IFrame API states: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued. */
export function ytPhase(state: number): Phase {
	switch (state) {
		case 1:
			return 'playing';
		case 2:
			return 'paused';
		case 0:
			return 'ended';
		case 3:
			return 'buffering';
		default:
			return 'idle';
	}
}

// TikTok embed player v1 (developers.tiktok.com/doc/embed-player, read 2026-11-19).
export type TikTokCommand = 'play' | 'pause' | 'seekTo' | 'mute' | 'unMute';

export function tiktokCommand(type: TikTokCommand, value?: number) {
	return { type, value, 'x-tiktok-player': true as const };
}

export type TikTokEvent =
	| { kind: 'ready' }
	| { kind: 'phase'; phase: Phase }
	| { kind: 'time'; time: number; duration: number };

const TT_STATES: Record<number, Phase> = { [-1]: 'idle', 0: 'ended', 1: 'playing', 2: 'paused', 3: 'buffering' };

/** A message from the TikTok iframe, or null for anything else (messages are untrusted). */
export function tiktokEvent(data: unknown): TikTokEvent | null {
	let d = data;
	if (typeof d === 'string') {
		try {
			d = JSON.parse(d);
		} catch {
			return null;
		}
	}
	if (!d || typeof d !== 'object') return null;
	const m = d as { 'x-tiktok-player'?: unknown; type?: unknown; value?: unknown };
	if (m['x-tiktok-player'] !== true) return null;
	switch (m.type) {
		case 'onPlayerReady':
			return { kind: 'ready' };
		case 'onStateChange':
			return typeof m.value === 'number' && m.value in TT_STATES ? { kind: 'phase', phase: TT_STATES[m.value] } : null;
		case 'onCurrentTime': {
			const v = m.value as { currentTime?: unknown; duration?: unknown } | undefined;
			if (typeof v?.currentTime !== 'number' || !Number.isFinite(v.currentTime)) return null;
			const duration = typeof v.duration === 'number' && Number.isFinite(v.duration) ? v.duration : 0;
			return { kind: 'time', time: v.currentTime, duration };
		}
		default:
			return null;
	}
}

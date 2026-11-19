import { describe, expect, it } from 'vitest';
import { clock, startOf, tiktokEvent, tiktokCommand, ytPhase } from './core.ts';

describe('clock', () => {
	it('prints m:ss and h:mm:ss, 0:00 for nothing', () => {
		expect(clock(0)).toBe('0:00');
		expect(clock(65.9)).toBe('1:05');
		expect(clock(3723)).toBe('1:02:03');
		expect(clock(NaN)).toBe('0:00');
		expect(clock(-3)).toBe('0:00');
	});
});

describe('startOf', () => {
	it('reads start= from an embed URL', () => {
		expect(startOf('https://www.youtube-nocookie.com/embed/x?playsinline=1&rel=0&start=42')).toBe(42);
		expect(startOf('https://www.youtube-nocookie.com/embed/x?playsinline=1')).toBe(0);
		expect(startOf('not a url')).toBe(0);
	});
});

describe('ytPhase', () => {
	it('maps YouTube player states to ours', () => {
		expect(ytPhase(1)).toBe('playing');
		expect(ytPhase(2)).toBe('paused');
		expect(ytPhase(0)).toBe('ended');
		expect(ytPhase(3)).toBe('buffering');
		expect(ytPhase(-1)).toBe('idle');
		expect(ytPhase(5)).toBe('idle');
	});
});

describe('tiktok messages (developers.tiktok.com/doc/embed-player, read 2026-11-19)', () => {
	it('builds host-to-player commands with the documented envelope', () => {
		expect(tiktokCommand('play')).toEqual({ type: 'play', value: undefined, 'x-tiktok-player': true });
		expect(tiktokCommand('seekTo', 12)).toEqual({ type: 'seekTo', value: 12, 'x-tiktok-player': true });
	});

	it('reads player-to-host events and ignores everything else', () => {
		expect(tiktokEvent({ 'x-tiktok-player': true, type: 'onPlayerReady' })).toEqual({ kind: 'ready' });
		expect(tiktokEvent({ 'x-tiktok-player': true, type: 'onStateChange', value: 1 })).toEqual({ kind: 'phase', phase: 'playing' });
		expect(tiktokEvent({ 'x-tiktok-player': true, type: 'onStateChange', value: 0 })).toEqual({ kind: 'phase', phase: 'ended' });
		expect(tiktokEvent({ 'x-tiktok-player': true, type: 'onCurrentTime', value: { currentTime: 3, duration: 20 } })).toEqual({
			kind: 'time',
			time: 3,
			duration: 20
		});
		expect(tiktokEvent({ type: 'onPlayerReady' })).toBeNull(); // no envelope flag
		expect(tiktokEvent('onPlayerReady')).toBeNull();
		expect(tiktokEvent({ 'x-tiktok-player': true, type: 'onCurrentTime', value: { currentTime: 'x' } })).toBeNull();
		expect(tiktokEvent(JSON.stringify({ 'x-tiktok-player': true, type: 'onPlayerReady' }))).toEqual({ kind: 'ready' });
	});
});

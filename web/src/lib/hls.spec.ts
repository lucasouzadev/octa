import { afterEach, describe, expect, it, vi } from 'vitest';

const instances: { loadSource: ReturnType<typeof vi.fn>; attachMedia: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> }[] = [];

vi.mock('hls.js', () => {
	class FakeHls {
		static isSupported = vi.fn(() => true);
		static Events = { ERROR: 'hlsError' };
		loadSource = vi.fn();
		attachMedia = vi.fn();
		destroy = vi.fn();
		on = vi.fn();
		constructor() {
			instances.push(this);
		}
	}
	return { default: FakeHls };
});

import { attachHls } from './hls.ts';

const video = (native: string) => ({ canPlayType: () => native, src: '' }) as unknown as HTMLVideoElement;

afterEach(() => {
	instances.length = 0;
});

describe('attachHls', () => {
	it('plays natively where the browser can (Safari): sets src, loads no library', async () => {
		const el = video('maybe');
		const stop = attachHls(el, 'https://cdn.example.com/a.m3u8');
		await Promise.resolve();
		expect(el.src).toBe('https://cdn.example.com/a.m3u8');
		expect(instances).toHaveLength(0);
		stop();
	});

	it('uses hls.js elsewhere and destroys it when the player goes away', async () => {
		const el = video('');
		const stop = attachHls(el, 'https://cdn.example.com/a.m3u8');
		await vi.waitFor(() => expect(instances).toHaveLength(1));
		expect(instances[0].loadSource).toHaveBeenCalledWith('https://cdn.example.com/a.m3u8');
		expect(instances[0].attachMedia).toHaveBeenCalledWith(el);
		stop();
		expect(instances[0].destroy).toHaveBeenCalled();
	});

	it('does not attach if it was stopped before the library arrived', async () => {
		const stop = attachHls(video(''), 'https://cdn.example.com/a.m3u8');
		stop();
		await new Promise((r) => setTimeout(r, 20));
		expect(instances.every((i) => i.attachMedia.mock.calls.length === 0)).toBe(true);
	});
});

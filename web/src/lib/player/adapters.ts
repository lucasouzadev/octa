// Adapters that only LISTEN to each platform's own player (R7.2): the platform draws its
// controls and its fullscreen; we read position and state to save "continuar assistindo"
// and "assistido". Official players only (ADR-0002): YouTube IFrame Player API, TikTok
// embed player v1 (postMessage), and the browser's own <video>.
import { tiktokCommand, tiktokEvent, ytPhase, type Phase } from './core.ts';

export interface MediaState {
	phase?: Phase;
	time?: number;
	duration?: number;
	ready?: boolean;
	failed?: boolean;
}

export interface Remote {
	play(): void;
	pause(): void;
	seek(sec: number): void;
	destroy(): void;
}

type Emit = (s: MediaState) => void;

export function nativeRemote(el: HTMLVideoElement, emit: Emit): Remote {
	const on: [string, () => void][] = [
		['loadedmetadata', () => emit({ ready: true, duration: el.duration })],
		['durationchange', () => emit({ duration: el.duration })],
		['timeupdate', () => emit({ time: el.currentTime })],
		['playing', () => emit({ phase: 'playing' })],
		['pause', () => emit({ phase: el.ended ? 'ended' : 'paused' })],
		['waiting', () => emit({ phase: 'buffering' })],
		['ended', () => emit({ phase: 'ended' })],
		['error', () => emit({ failed: true })]
	];
	for (const [n, f] of on) el.addEventListener(n, f);
	return {
		play: () => void el.play().catch(() => emit({ phase: 'paused' })),
		pause: () => el.pause(),
		seek: (s) => (el.currentTime = s),
		destroy: () => on.forEach(([n, f]) => el.removeEventListener(n, f))
	};
}

// ---- YouTube IFrame Player API (developers.google.com/youtube/iframe_api_reference) ----

interface YTPlayer {
	playVideo(): void;
	pauseVideo(): void;
	seekTo(s: number, allowSeekAhead: boolean): void;
	getCurrentTime(): number;
	getDuration(): number;
	destroy(): void;
}
interface YTNamespace {
	Player: new (el: HTMLElement, opts: object) => YTPlayer;
}

let ytLoading: Promise<YTNamespace> | null = null;

function loadYouTubeApi(): Promise<YTNamespace> {
	const w = window as unknown as { YT?: YTNamespace & { loaded?: number }; onYouTubeIframeAPIReady?: () => void };
	if (w.YT?.Player) return Promise.resolve(w.YT);
	if (!ytLoading) {
		ytLoading = new Promise((resolve, reject) => {
			const prev = w.onYouTubeIframeAPIReady;
			w.onYouTubeIframeAPIReady = () => {
				prev?.();
				resolve(w.YT!);
			};
			const s = document.createElement('script');
			s.src = 'https://www.youtube.com/iframe_api';
			s.async = true;
			s.onerror = () => {
				ytLoading = null;
				reject(new Error('youtube api'));
			};
			document.head.append(s);
		});
	}
	return ytLoading;
}

export function youtubeRemote(host: HTMLElement, id: string, start: number, title: string, emit: Emit): Remote {
	let player: YTPlayer | null = null;
	let gone = false;
	let poll = 0;

	const tick = () => {
		if (player) emit({ time: player.getCurrentTime(), duration: player.getDuration() });
	};
	const startPoll = () => {
		if (!poll) poll = window.setInterval(tick, 250);
	};
	const stopPoll = () => {
		clearInterval(poll);
		poll = 0;
	};

	loadYouTubeApi()
		.then((YT) => {
			if (gone) return;
			const slot = document.createElement('div');
			host.append(slot);
			player = new YT.Player(slot, {
				videoId: id,
				host: 'https://www.youtube-nocookie.com',
				// The platform's own bar and fullscreen (R7.2): nothing of ours on top.
				playerVars: { controls: 1, playsinline: 1, rel: 0, fs: 1, iv_load_policy: 3, start },
				events: {
					onReady: (e: { target: HTMLElement & { getIframe?: () => HTMLIFrameElement } }) => {
						if (gone) return;
						const frame = (e.target as unknown as { getIframe?: () => HTMLIFrameElement }).getIframe?.();
						frame?.setAttribute('title', title);
						// The platform's own fullscreen must be allowed on the iframe it builds (R7.2).
						const allow = frame?.getAttribute('allow') ?? '';
						if (frame && !/\bfullscreen\b/.test(allow)) frame.setAttribute('allow', `${allow}${allow ? '; ' : ''}fullscreen`);
						frame?.setAttribute('allowfullscreen', '');
						emit({ ready: true, duration: player!.getDuration() });
					},
					onStateChange: (e: { data: number }) => {
						const phase = ytPhase(e.data);
						tick(); // the time first, so a pause saves where it stopped
						emit({ phase });
						if (phase === 'playing') startPoll();
						else stopPoll();
					},
					onError: () => emit({ failed: true })
				}
			});
		})
		.catch(() => !gone && emit({ failed: true }));

	return {
		play: () => player?.playVideo(),
		pause: () => player?.pauseVideo(),
		seek: (s) => {
			player?.seekTo(s, true);
			emit({ time: s });
		},
		destroy: () => {
			gone = true;
			stopPoll();
			player?.destroy();
			host.replaceChildren();
		}
	};
}

// ---- TikTok embed player v1 (developers.tiktok.com/doc/embed-player, read 2026-11-19) ----

const TIKTOK_ORIGIN = 'https://www.tiktok.com';

export function tiktokRemote(frame: HTMLIFrameElement, emit: Emit, start = 0): Remote {
	let ready = false;
	const send = (type: Parameters<typeof tiktokCommand>[0], value?: number) =>
		frame.contentWindow?.postMessage(tiktokCommand(type, value), TIKTOK_ORIGIN);

	// Only messages from this iframe and from TikTok's origin count (untrusted input).
	const onMessage = (e: MessageEvent) => {
		if (e.source !== frame.contentWindow || e.origin !== TIKTOK_ORIGIN) return;
		const ev = tiktokEvent(e.data);
		if (!ev) return;
		if (ev.kind === 'ready') {
			ready = true;
			emit({ ready: true });
			if (start > 0) send('seekTo', start);
		} else if (ev.kind === 'phase') emit({ phase: ev.phase });
		else emit({ time: ev.time, duration: ev.duration || undefined });
	};
	window.addEventListener('message', onMessage);
	return {
		play: () => ready && send('play'),
		pause: () => ready && send('pause'),
		seek: (s) => ready && send('seekTo', s),
		destroy: () => window.removeEventListener('message', onMessage)
	};
}

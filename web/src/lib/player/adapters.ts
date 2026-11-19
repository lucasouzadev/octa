// Adapters between octa's one control bar and each real player (slice 3c). Every
// adapter takes a callback for state and returns the same small remote control.
// Official players only (ADR-0002): YouTube IFrame Player API, TikTok embed player v1
// (postMessage), and the browser's own <video>.
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
	let wantPlay = true; // the person tapped play on the poster

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
				playerVars: { controls: 0, playsinline: 1, rel: 0, disablekb: 1, fs: 0, iv_load_policy: 3, start },
				events: {
					onReady: (e: { target: HTMLElement & { getIframe?: () => HTMLIFrameElement } }) => {
						if (gone) return;
						const frame = (e.target as unknown as { getIframe?: () => HTMLIFrameElement }).getIframe?.();
						frame?.setAttribute('title', title);
						emit({ ready: true, duration: player!.getDuration() });
						if (wantPlay) player!.playVideo();
					},
					onStateChange: (e: { data: number }) => {
						const phase = ytPhase(e.data);
						emit({ phase });
						if (phase === 'playing') startPoll();
						else stopPoll();
						tick();
					},
					onError: () => emit({ failed: true })
				}
			});
		})
		.catch(() => !gone && emit({ failed: true }));

	return {
		play: () => {
			wantPlay = true;
			player?.playVideo();
		},
		pause: () => {
			wantPlay = false;
			player?.pauseVideo();
		},
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
	let wantPlay = true;
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
			if (wantPlay) send('play');
		} else if (ev.kind === 'phase') emit({ phase: ev.phase });
		else emit({ time: ev.time, duration: ev.duration || undefined });
	};
	window.addEventListener('message', onMessage);
	return {
		play: () => {
			wantPlay = true;
			if (ready) send('play');
		},
		pause: () => {
			wantPlay = false;
			if (ready) send('pause');
		},
		seek: (s) => ready && send('seekTo', s),
		destroy: () => window.removeEventListener('message', onMessage)
	};
}

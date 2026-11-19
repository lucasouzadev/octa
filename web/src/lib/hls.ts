// HLS playback (.m3u8). Safari plays it natively; everywhere else hls.js does, loaded
// on demand so nobody pays for it who never opens an HLS link. Official docs checked
// 2026-11-19: hls.js 1.7.4 (`Hls.isSupported()`, `loadSource`, `attachMedia`, `destroy`).

/** Attach `src` to the <video>; returns the function that releases everything. */
export function attachHls(el: HTMLVideoElement, src: string): () => void {
	let stopped = false;
	let release = () => {};
	if (el.canPlayType('application/vnd.apple.mpegurl')) {
		el.src = src;
		return () => {};
	}
	import('hls.js')
		.then(({ default: Hls }) => {
			if (stopped || !Hls.isSupported()) return;
			const hls = new Hls();
			hls.loadSource(src);
			hls.attachMedia(el);
			release = () => hls.destroy();
		})
		.catch(() => {
			// the chunk failed to load: the player stays empty, the card still says what it is
		});
	return () => {
		stopped = true;
		release();
	};
}

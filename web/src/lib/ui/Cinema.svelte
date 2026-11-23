<script lang="ts">
	// The player screen (R7.2): the platform's OWN player, nothing of ours on top of it.
	// No cover, no big play, no bar, no fullscreen of ours: the picture is there at once,
	// the platform's controls (and its fullscreen) run it, and a direct file gets the
	// browser's own `controls`. What stays on our side is only listening: the position and
	// the end are read through each platform's API (YouTube IFrame API, TikTok player v1
	// postMessage, <video> events) to keep "continuar assistindo" and "assistido".
	// Instagram has no API: a pure embed. The original link sits below the picture.
	import { onDestroy, untrack } from 'svelte';
	import type { Video } from '#lib/db/index.ts';
	import { cardLabel } from '#lib/fan.ts';
	import { attachHls } from '#lib/hls.ts';
	import { resumeAt, shouldSave, startOf, type Phase } from '#lib/player/core.ts';
	import { nativeRemote, tiktokRemote, youtubeRemote, type MediaState, type Remote } from '#lib/player/adapters.ts';

	let {
		video,
		onended,
		onprogress
	}: {
		video: Video;
		onended?: () => void;
		/** Where the person is, saved at most every 5 s and when they stop; null = finished. */
		onprogress?: (sec: number | null, duration: number) => void;
	} = $props();

	// Where this video was left (slice 3b "Continuar assistindo"); read once when it opens.
	const resume = untrack(() => resumeAt(video.positionSec, video.durationSec));
	let lastSaved = resume;

	const vertical = $derived(video.embed.aspect === '9:16');
	const native = $derived(video.embed.type === 'video' || video.embed.type === 'hls');
	const provider = $derived(video.source === 'direct' ? 'Arquivo' : cardLabel(video));
	const shortLink = $derived(video.canonicalUrl.replace(/^https?:\/\/(www\.)?/, ''));

	let phase: Phase = 'idle';
	let time = untrack(() => resume);
	let duration = 0;
	let failed = $state(false);
	let remote: Remote | null = null;

	function emit(s: MediaState) {
		if (s.phase) {
			phase = s.phase;
			if (s.phase === 'ended') {
				onended?.();
				onprogress?.(null, duration);
			} else if (s.phase === 'paused') save();
		}
		if (s.time !== undefined && Number.isFinite(s.time)) {
			time = s.time;
			if (phase === 'playing' && shouldSave(lastSaved, s.time)) save();
		}
		if (s.duration !== undefined && Number.isFinite(s.duration) && s.duration > 0) duration = s.duration;
		if (s.failed) failed = true;
	}

	function save() {
		if (!Number.isFinite(time) || time <= 0 || phase === 'ended') return;
		lastSaved = time;
		onprogress?.(time, duration);
	}

	// Actions bind a listener to the element each source renders.
	function useNative(el: HTMLVideoElement) {
		const stopHls = video.embed.type === 'hls' ? attachHls(el, video.embed.src) : () => {};
		if (video.embed.type !== 'hls') el.src = video.embed.src;
		remote = nativeRemote(el, emit);
		if (resume > 0) el.addEventListener('loadedmetadata', () => (el.currentTime = resume), { once: true });
		return {
			destroy() {
				remote?.destroy();
				stopHls();
			}
		};
	}

	function useYouTube(el: HTMLElement) {
		remote = youtubeRemote(el, video.id.length === 11 ? video.id : idFromEmbed(), resume || startOf(video.embed.src), video.title, emit);
		return { destroy: () => remote?.destroy() };
	}

	function useTikTok(el: HTMLIFrameElement) {
		remote = tiktokRemote(el, emit, resume);
		return { destroy: () => remote?.destroy() };
	}

	function idFromEmbed(): string {
		const m = /\/embed\/([A-Za-z0-9_-]{11})/.exec(video.embed.src);
		return m ? m[1] : '';
	}

	onDestroy(() => {
		save(); // leaving the screen is a stop too
		remote?.destroy();
	});
</script>

<div class="cinema">
	<div class="screen">
		<div class="frame" class:vertical>
			{#if native}
				<!-- svelte-ignore a11y_media_has_caption (third-party files have no captions we can know of) -->
				<video use:useNative controls playsinline preload="metadata" poster={video.thumbnail} title={video.title}></video>
			{:else if video.source === 'youtube'}
				<div class="yt" use:useYouTube></div>
			{:else if video.source === 'tiktok'}
				<iframe
					use:useTikTok
					src={video.embed.src}
					title={video.title}
					allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
					allowfullscreen
					referrerpolicy="strict-origin-when-cross-origin"
					sandbox="allow-scripts allow-same-origin allow-presentation"
				></iframe>
			{:else}
				<iframe
					src={video.embed.src}
					title={video.title}
					allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture; web-share"
					allowfullscreen
					referrerpolicy="strict-origin-when-cross-origin"
					sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
				></iframe>
			{/if}
			{#if failed}
				<p class="failed" role="status">Não deu para tocar aqui. Abra no original.</p>
			{/if}
		</div>
	</div>

	<a class="origin" href={video.canonicalUrl} target="_blank" rel="noopener noreferrer" aria-label={`Abrir no ${provider}`}>
		<span class="link">{shortLink}</span>
	</a>
</div>

<style>
	/* The cinema adds no box of its own: its parts sit in the page's column. */
	.cinema {
		display: contents;
	}

	.screen {
		flex: 1 1 0;
		min-height: 0;
		container-type: size;
		display: grid;
		/* Spare height is split above and below, so the picture sits in the middle. */
		place-items: center;
	}

	/* Sized from the box the page gives it (a size container), so it always fits. */
	.frame {
		position: relative;
		width: min(100cqw, calc(100cqh * 16 / 9));
		aspect-ratio: 16 / 9;
		border-radius: var(--radius-video);
		overflow: hidden;
		background: var(--color-surface-dark-raised);
	}

	.frame.vertical {
		aspect-ratio: 9 / 16;
		width: auto;
		height: min(100cqh, calc(100cqw * 16 / 9));
	}

	iframe,
	video,
	.yt,
	.yt :global(iframe) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
		background: #000;
	}

	video {
		object-fit: contain;
	}

	.failed {
		position: absolute;
		inset: auto 0 0;
		padding: var(--space-3);
		background: rgb(0 0 0 / 0.75);
		color: var(--color-text-dark);
		font-size: var(--size-label);
		text-align: center;
	}

	.origin {
		flex: none;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
		text-decoration: none;
		color: var(--color-muted-on-dark);
		font-size: 13px;
	}

	.link {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		padding: 4px 10px;
		border-radius: 999px;
		background: var(--color-surface-dark-raised);
	}
</style>

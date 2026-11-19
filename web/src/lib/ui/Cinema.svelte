<script lang="ts">
	// The personal cinema (slice 3c): one player look for every source. The screen opens
	// at once with the cover; the platform's own player loads only on the first tap, with
	// its chrome turned off where the platform allows it (YouTube controls=0, TikTok
	// player v1 params). Our one control bar sits BELOW the picture, never over it
	// (YouTube RMF: no overlays on the embedded player). Instagram has no control API,
	// so it keeps its own player and gets no bar. MP4/HLS are fully ours.
	import { onDestroy } from 'svelte';
	import type { Video } from '#lib/db/index.ts';
	import { cardLabel } from '#lib/fan.ts';
	import { attachHls } from '#lib/hls.ts';
	import { clock, startOf, type Phase } from '#lib/player/core.ts';
	import { nativeRemote, tiktokRemote, youtubeRemote, type MediaState, type Remote } from '#lib/player/adapters.ts';
	import Icon from '#lib/ui/Icon.svelte';

	let { video, onended }: { video: Video; onended?: () => void } = $props();

	const vertical = $derived(video.embed.aspect === '9:16');
	const native = $derived(video.embed.type === 'video' || video.embed.type === 'hls');
	const controllable = $derived(native || video.source === 'youtube' || video.source === 'tiktok');
	const provider = $derived(video.source === 'direct' ? 'Arquivo' : cardLabel(video));
	const shortLink = $derived(video.canonicalUrl.replace(/^https?:\/\/(www\.)?/, ''));

	let started = $state(false); // iframes load on the first tap
	let phase = $state<Phase>('idle');
	let time = $state(0);
	let duration = $state(0);
	let failed = $state(false);
	let remote: Remote | null = null;
	let frameEl = $state<HTMLElement | null>(null);

	function emit(s: MediaState) {
		if (s.phase) {
			phase = s.phase;
			if (s.phase === 'ended') onended?.();
		}
		if (s.time !== undefined && Number.isFinite(s.time)) time = s.time;
		if (s.duration !== undefined && Number.isFinite(s.duration) && s.duration > 0) duration = s.duration;
		if (s.failed) failed = true;
	}

	// Actions bind a remote to the element each source renders.
	function useNative(el: HTMLVideoElement) {
		const stopHls = video.embed.type === 'hls' ? attachHls(el, video.embed.src) : () => {};
		if (video.embed.type !== 'hls') el.src = video.embed.src;
		remote = nativeRemote(el, emit);
		return {
			destroy() {
				remote?.destroy();
				stopHls();
			}
		};
	}

	function useYouTube(el: HTMLElement) {
		remote = youtubeRemote(el, video.id.length === 11 ? video.id : idFromEmbed(), startOf(video.embed.src), video.title, emit);
		return { destroy: () => remote?.destroy() };
	}

	function useTikTok(el: HTMLIFrameElement) {
		remote = tiktokRemote(el, emit);
		return { destroy: () => remote?.destroy() };
	}

	function idFromEmbed(): string {
		const m = /\/embed\/([A-Za-z0-9_-]{11})/.exec(video.embed.src);
		return m ? m[1] : '';
	}

	function start() {
		started = true;
		phase = 'buffering';
	}

	function toggle() {
		if (!native && !started) return start();
		if (phase === 'playing' || phase === 'buffering') remote?.pause();
		else remote?.play();
	}

	function seek(e: Event) {
		const v = Number((e.currentTarget as HTMLInputElement).value);
		time = v;
		remote?.seek(v);
	}

	function fullscreen() {
		const el = frameEl;
		const v = el?.querySelector('video') as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
		if (el?.requestFullscreen) el.requestFullscreen().catch(() => v?.webkitEnterFullscreen?.());
		else v?.webkitEnterFullscreen?.(); // iPhone Safari: only a <video> can go fullscreen
	}

	onDestroy(() => remote?.destroy());

	const playing = $derived(phase === 'playing' || phase === 'buffering');
</script>

<div class="screen">
	<div class="frame" class:vertical bind:this={frameEl} data-phase={phase}>
		{#if native}
			<!-- svelte-ignore a11y_media_has_caption (third-party files have no captions we can know of) -->
			<video
				use:useNative
				playsinline
				preload="metadata"
				poster={video.thumbnail}
				title={video.title}
				onclick={toggle}
			></video>
		{:else if !started}
			<button class="poster" type="button" aria-label={`Assistir “${video.title}”`} onclick={start}>
				{#if video.thumbnail}<img
						src={video.thumbnail}
						alt=""
						referrerpolicy="no-referrer"
						onerror={(e) => ((e.currentTarget as HTMLElement).style.display = 'none')}
					/>{/if}
				<span class="big-play" aria-hidden="true"><Icon name="play" size={28} /></span>
			</button>
		{:else if video.source === 'youtube'}
			<div class="yt" use:useYouTube></div>
		{:else if video.source === 'tiktok'}
			<iframe
				use:useTikTok
				src={video.embed.src}
				title={video.title}
				allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
				referrerpolicy="strict-origin-when-cross-origin"
				sandbox="allow-scripts allow-same-origin allow-presentation"
			></iframe>
		{:else}
			<iframe
				src={video.embed.src}
				title={video.title}
				allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
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

{#if controllable}
	<div class="bar" aria-label="Controles do vídeo" role="group">
		<button type="button" class="pp" aria-label={playing ? 'Pausar' : 'Reproduzir'} onclick={toggle}>
			<Icon name={playing ? 'pause' : 'play'} size={18} />
		</button>
		<span class="t">{clock(time)}</span>
		<input
			type="range"
			aria-label="Posição no vídeo"
			min="0"
			max={duration || 0}
			step="0.1"
			value={Math.min(time, duration || 0)}
			disabled={!duration}
			oninput={seek}
			style={`--p: ${duration ? (Math.min(time, duration) / duration) * 100 : 0}%`}
		/>
		<span class="t">{clock(duration)}</span>
		<button type="button" class="fs" aria-label="Tela cheia" onclick={fullscreen}>
			<Icon name="expand" size={18} />
		</button>
	</div>
{/if}

<a class="origin" href={video.canonicalUrl} target="_blank" rel="noopener noreferrer" aria-label={`Abrir no ${provider}`}>
	<span class="provider">{provider}</span>
	<span class="link">{shortLink}</span>
</a>

<style>
	.screen {
		flex: 1 1 0;
		min-height: 0;
		container-type: size;
		display: grid;
		/* The picture rests on the control bar; spare height goes above it. */
		place-items: end center;
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
	.yt :global(iframe),
	.poster {
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

	.poster {
		padding: 0;
		background: transparent;
		display: grid;
		place-items: center;
		cursor: pointer;
	}

	.poster img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.big-play {
		position: relative;
		display: grid;
		place-items: center;
		width: 72px;
		height: 72px;
		border-radius: 50%;
		background: rgb(255 255 255 / 0.94);
		color: #0a0a0a;
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.4);
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

	.bar {
		flex: none;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--color-text-dark);
	}

	.bar button {
		flex: none;
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		border: 0;
		background: var(--color-surface-dark-raised);
		color: inherit;
		cursor: pointer;
	}

	.bar .pp {
		background: var(--color-text-dark);
		color: #0a0a0a;
	}

	.t {
		flex: none;
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		color: var(--color-muted-on-dark);
		min-width: 3.2em;
		text-align: center;
	}

	input[type='range'] {
		flex: 1;
		min-width: 0;
		height: 24px;
		margin: 0;
		background: transparent;
		accent-color: var(--color-text-dark);
		-webkit-appearance: none;
		appearance: none;
	}

	input[type='range']::-webkit-slider-runnable-track {
		height: 4px;
		border-radius: 2px;
		background: linear-gradient(var(--color-text-dark), var(--color-text-dark)) 0 / var(--p) 100% no-repeat,
			var(--color-surface-dark-raised);
	}

	input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 14px;
		height: 14px;
		margin-top: -5px;
		border-radius: 50%;
		background: var(--color-text-dark);
	}

	input[type='range']::-moz-range-track {
		height: 4px;
		border-radius: 2px;
		background: var(--color-surface-dark-raised);
	}

	input[type='range']::-moz-range-progress {
		height: 4px;
		border-radius: 2px;
		background: var(--color-text-dark);
	}

	input[type='range']:disabled {
		opacity: 0.4;
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

	.provider {
		flex: none;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		font-size: var(--size-label);
		color: var(--color-text-dark);
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

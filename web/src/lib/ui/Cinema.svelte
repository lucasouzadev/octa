<script lang="ts">
	// The personal cinema (slices 3c and 3d): one play, one look for every source.
	// The platform's own player is loaded UNDER the cover as soon as the screen opens, so
	// the first tap lands on our big button and starts the video in the same gesture (iOS
	// only lets a video start from a tap) with no loading wait. The cover goes away once
	// the video plays; if the platform refuses to start (iOS), it goes away after a short
	// wait and the platform's own play button is the one to tap. After that, all control
	// lives in the bar BELOW the picture, never over it (YouTube RMF: no overlays on the
	// embedded player). Instagram has no control API: its own player is the only one, no
	// cover and no bar. MP4/HLS are fully ours.
	import { onDestroy, tick, untrack } from 'svelte';
	import type { Video } from '#lib/db/index.ts';
	import { cardLabel } from '#lib/fan.ts';
	import { attachHls } from '#lib/hls.ts';
	import { clock, resumeAt, resumeLabel, shouldSave, staleEvent, startOf, type Phase } from '#lib/player/core.ts';
	import { nativeRemote, tiktokRemote, youtubeRemote, type MediaState, type Remote } from '#lib/player/adapters.ts';
	import Icon from '#lib/ui/Icon.svelte';

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
	const controllable = $derived(native || video.source === 'youtube' || video.source === 'tiktok');
	const provider = $derived(video.source === 'direct' ? 'Arquivo' : cardLabel(video));
	const shortLink = $derived(video.canonicalUrl.replace(/^https?:\/\/(www\.)?/, ''));

	const coverLabel = resumeLabel(resume);

	// The person tapped the cover. `revealed`: the cover is gone, either because the video
	// is playing or because the platform did not start it and its own play must be shown.
	let tapped = $state(false);
	let revealed = $state(false);
	let blockTimer = 0;
	// The platform refused to start the video: its own play must stay tappable.
	let blocked = $state(false);
	// A play/pause we already showed, until the platform answers.
	let wanted: Phase | null = null;
	let wantedUntil = 0;
	let wantedTimer = 0;
	// While it plays, touches stay on our side: a tap on the picture never reaches the
	// platform, so its title bar and buttons do not pop up on touch.
	const ownTaps = $derived(controllable && revealed && !blocked);
	// Our own full screen (iPhone Safari cannot put an iframe in the system's).
	let immersive = $state(false);
	const covered = $derived(controllable && !revealed);
	let phase = $state<Phase>('idle');
	let time = $state(untrack(() => resume));
	let duration = $state(0);
	let failed = $state(false);
	let remote: Remote | null = null;
	let frameEl = $state<HTMLElement | null>(null);
	let cinemaEl = $state<HTMLElement | null>(null);
	let fsEntered = false;

	function emit(s: MediaState) {
		if (s.phase && wanted && performance.now() < wantedUntil && staleEvent(wanted, s.phase)) {
			s = { ...s, phase: undefined };
		}
		if (s.phase) {
			phase = s.phase;
			if (s.phase === 'playing') {
				blocked = false;
				reveal();
			}
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
		// The platform finished loading after the tap: give it a moment to start.
		if (s.ready && tapped && !revealed) armBlockTimer(1800);
	}

	function reveal() {
		clearTimeout(blockTimer);
		revealed = true;
	}

	// Playing after the tap did not happen: the platform wants its own tap. Show its player.
	function armBlockTimer(ms: number) {
		clearTimeout(blockTimer);
		blockTimer = window.setTimeout(() => {
			if (revealed) return;
			revealed = true;
			blocked = true;
			phase = 'paused';
		}, ms);
	}

	function save() {
		if (!Number.isFinite(time) || time <= 0 || phase === 'ended') return;
		lastSaved = time;
		onprogress?.(time, duration);
	}

	// Actions bind a remote to the element each source renders.
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

	function start() {
		if (tapped) return;
		tapped = true;
		phase = 'buffering';
		remote?.play(); // inside the tap, which is what iOS asks for
		armBlockTimer(remote ? 2500 : 4000);
		if (vertical && controllable) enterFullscreen(); // vertical videos are watched full screen
	}

	// A tap on the picture toggles like a native player; the cover's own tap (which starts it) never does.
	function tapPicture(e: MouseEvent) {
		if (!ownTaps || native) return;
		if ((e.target as Element).closest('.cover')) return;
		toggle();
	}

	// Our interface answers at once; the platform follows a moment later.
	function toggle() {
		if (!tapped) return start();
		clearTimeout(wantedTimer);
		wantedUntil = performance.now() + 900;
		if (phase === 'playing' || phase === 'buffering') {
			wanted = 'paused';
			phase = 'paused';
			remote?.pause();
		} else {
			wanted = 'playing';
			phase = 'buffering';
			remote?.play();
			// If it never starts (the platform wants its own tap), give the control back.
			wantedTimer = window.setTimeout(() => {
				if (phase === 'buffering') phase = 'paused';
			}, 2500);
		}
	}

	function seek(e: Event) {
		const v = Number((e.currentTarget as HTMLInputElement).value);
		time = v;
		remote?.seek(v);
	}

	async function enterFullscreen() {
		immersive = true;
		await tick(); // the box exists once it is no longer `display: contents`
		// Where the browser allows it (desktop, iPad, Android) also hide its own bars.
		// The whole cinema goes, so our bar comes along; iPhone Safari refuses and keeps ours.
		cinemaEl?.requestFullscreen?.().catch(() => {});
	}

	function exitFullscreen() {
		immersive = false;
		if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
	}

	function fullscreen() {
		if (immersive) return exitFullscreen();
		enterFullscreen();
	}

	function onFullscreenChange() {
		// Escape (or the system gesture) left the browser's full screen: leave ours too.
		if (immersive && !document.fullscreenElement && fsEntered) immersive = false;
		fsEntered = !!document.fullscreenElement;
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && immersive) exitFullscreen();
	}

	onDestroy(() => {
		clearTimeout(blockTimer);
		clearTimeout(wantedTimer);
		if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
		save(); // leaving the screen is a stop too
		remote?.destroy();
	});

	const playing = $derived(phase === 'playing' || phase === 'buffering');
</script>

<svelte:document onfullscreenchange={onFullscreenChange} onkeydown={onKey} />

<div class="cinema" class:full={immersive} bind:this={cinemaEl}>
{#if immersive}
	<button type="button" class="leave" aria-label="Sair da tela cheia" onclick={exitFullscreen}>
		<Icon name="close" size={18} />
	</button>
{/if}
<div class="screen">
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (the bar below is the keyboard path) -->
	<div
		class="frame"
		class:vertical
		class:own-taps={ownTaps}
		bind:this={frameEl}
		data-phase={phase}
		onclick={tapPicture}
	>
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
		{#if covered}
			<button
				class="cover"
				class:over-video={native}
				type="button"
				disabled={tapped}
				aria-label={coverLabel ? `${coverLabel.replace(' · ', ' de ')}: “${video.title}”` : `Assistir “${video.title}”`}
				onclick={start}
			>
				{#if video.thumbnail && !native}<img
						src={video.thumbnail}
						alt=""
						referrerpolicy="no-referrer"
						onerror={(e) => ((e.currentTarget as HTMLElement).style.display = 'none')}
					/>{/if}
				<span class="big-play" class:wait={tapped} aria-hidden="true">
					{#if tapped}<span class="spin"></span>{:else}<Icon name="play" size={28} />{/if}
				</span>
				{#if coverLabel && !tapped}<span class="resume" aria-hidden="true">{coverLabel}</span>{/if}
			</button>
		{/if}
		{#if failed}
			<p class="failed" role="status">Não deu para tocar aqui. Abra no original.</p>
		{/if}
	</div>
</div>

{#if controllable}
	<div class="bar" aria-label="Controles do vídeo" role="group">
		<button type="button" class="pp" class:unstarted={!revealed} aria-hidden={!revealed} tabindex={revealed ? 0 : -1} aria-label={playing ? 'Pausar' : 'Reproduzir'} onclick={toggle}>
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
	<span class="link">{shortLink}</span>
</a>
</div>

<style>
	/* Normally the cinema adds no box of its own: its parts sit in the page's column. */
	.cinema {
		display: contents;
	}

	/* Our full screen: the whole viewport, black, picture as big as it gets, bar below it. */
	.cinema.full {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		background: #000;
		/* No side padding: the picture goes edge to edge; the button and the bar keep their own. */
		padding: calc(var(--space-4) + env(safe-area-inset-top)) 0 calc(var(--space-3) + env(safe-area-inset-bottom));
	}

	.cinema.full .leave {
		margin-inline-start: var(--space-4);
	}

	.cinema.full .bar {
		margin-inline: var(--space-4);
	}

	/* In our full screen the spare height is split above and below: the picture is centered. */
	.cinema.full .screen {
		place-items: center;
	}

	.cinema.full .frame:not(.vertical) {
		border-radius: 0;
	}

	.cinema.full .origin {
		display: none;
	}

	.leave {
		flex: none;
		align-self: flex-start;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: 0;
		border-radius: 50%;
		background: var(--color-surface-dark-raised);
		color: var(--color-text-dark);
		cursor: pointer;
	}

	/* While it plays the platform never sees a touch (see ownTaps). */
	.frame.own-taps iframe,
	.frame.own-taps .yt :global(iframe) {
		pointer-events: none;
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
	.yt :global(iframe),
	.cover {
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

	.cover {
		padding: 0;
		background: #0a0a0a; /* opaque: hides the platform player loading underneath */
		display: grid;
		place-items: center;
		cursor: pointer;
	}

	.cover img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	/* Over a file we play ourselves the video's own first frame stays visible. */
	.cover.over-video {
		background: transparent;
	}

	.cover:disabled {
		cursor: default;
	}

	.resume {
		position: absolute;
		bottom: var(--space-4);
		left: 50%;
		translate: -50% 0;
		padding: 6px 14px;
		border-radius: 999px;
		background: rgb(0 0 0 / 0.62);
		color: #fff;
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.spin {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		border: 3px solid rgb(10 10 10 / 0.18);
		border-top-color: #0a0a0a;
		animation: spin 0.9s linear infinite;
	}

	@keyframes spin {
		to {
			rotate: 360deg;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.spin {
			animation-duration: 3s;
		}
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

	/* The big button on the cover is the only play until the video has started. */
	.bar .pp.unstarted {
		visibility: hidden;
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

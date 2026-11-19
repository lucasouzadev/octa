<script lang="ts">
	import type { Video } from '#lib/db/index.ts';

	// Official players only (ADR-0002). The video itself is always 2D (ADR-0003).
	let { video }: { video: Video } = $props();
	const vertical = $derived(video.embed.aspect === '9:16');
</script>

<div class="frame" class:vertical>
	{#if video.embed.type === 'iframe'}
		<iframe
			src={video.embed.src}
			title={video.title}
			allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
			allowfullscreen
			referrerpolicy="strict-origin-when-cross-origin"
			sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
		></iframe>
	{:else}
		<!-- svelte-ignore a11y_media_has_caption (third-party files have no captions we can know of) -->
		<video src={video.embed.src} controls playsinline preload="metadata" title={video.title}></video>
	{/if}
</div>

<style>
	/* Sized from the box the page gives it (a size container), so it always fits. */
	.frame {
		position: relative;
		width: min(100cqw, calc(100cqh * 16 / 9));
		aspect-ratio: 16 / 9;
		border-radius: var(--radius-video);
		overflow: hidden;
		background: var(--color-surface-dark);
	}

	.frame.vertical {
		aspect-ratio: 9 / 16;
		width: auto;
		height: min(100cqh, calc(100cqw * 16 / 9));
	}

	iframe,
	video {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
		background: #000;
	}
</style>

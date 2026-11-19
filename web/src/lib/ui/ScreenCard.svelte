<script lang="ts">
	// One video on the Collection screen (prototype page 3): a tilted "screen" in a cream
	// bezel with thickness, "SOURCE · length", the link status and the
	// title in serif. CSS-3D renderer; the pose comes from lib/shelf.ts so a WebGL
	// version can use the same numbers.
	import type { Video } from '#lib/db/index.ts';
	import { cardLabel } from '#lib/fan.ts';
	import { formatDuration, screenTilt, statusOf } from '#lib/shelf.ts';
	import { markSource } from '#lib/transition.ts';
	import Icon from '#lib/ui/Icon.svelte';

	let {
		video,
		index,
		href,
		flat = false,
		heart = false
	}: { video: Video; index: number; href: string; flat?: boolean; heart?: boolean } = $props();

	const tilt = $derived(screenTilt(index));
	const duration = $derived(formatDuration(video.durationSec));
	const status = $derived(statusOf(video.health));
</script>

<a
	class="row screen"
	class:flat
	class:has-heart={heart}
	class:dead={status?.tone === 'dead'}
	{href}
	style={`--rz: ${tilt.rotZ}deg; --ry: ${tilt.rotY}deg; --sx: ${tilt.shiftX}%`}
	onclick={(e) => markSource(e, '.thumb')}
>
	<span class="name">{video.title}</span>
	<span class="meta">
		<span class="src">{cardLabel(video)}</span>{#if duration}<span class="dur">· {duration}</span>{/if}
		{#if status}<span class="status" class:dead={status.tone === 'dead'}>{status.label}</span>{/if}
		{#if video.watched}<span class="status seen">Assistido</span>{/if}
	</span>
	<span class="thumb">
		{#if video.thumbnail}<img
				src={video.thumbnail}
				alt=""
				loading="lazy"
				referrerpolicy="no-referrer"
				onerror={(e) => ((e.currentTarget as HTMLElement).style.display = 'none')}
			/>{/if}
	</span>
	{#if heart}<span class="heart" aria-hidden="true"><Icon name="heart" size={22} filled /></span>{/if}
</a>

<style>
	.screen {
		position: relative; /* offset* measures (WebGL monitors) are taken from here */
		--bezel: 10px;
		display: grid;
		/* Read order is title first (screen readers); the eye sees thumb, meta, title. */
		grid-template-areas: 'thumb' 'meta' 'name';
		gap: var(--space-2);
		/* The next screen covers --overlap of this one's bottom; keep the title above that. */
		padding: var(--bezel) var(--bezel) calc(var(--overlap, 0px) + var(--space-3));
		border-radius: 18px;
		background: var(--color-paper-base);
		color: var(--color-text-light);
		text-decoration: none;
		/* Thickness: three edge tones stepping down-right, then a soft cast shadow. */
		box-shadow:
			1px 1px 0 var(--color-paper-edge1),
			2px 2px 0 var(--color-paper-edge2),
			3px 3px 0 var(--color-paper-edge3),
			10px 16px 28px rgb(0 0 0 / 0.55),
			inset 0 1px 0 rgb(255 255 255 / 0.7);
		transform: rotateX(6deg) rotateY(var(--ry)) rotateZ(var(--rz)) translateX(var(--sx));
		transform-origin: 50% 40%;
	}

	.screen.flat {
		transform: none;
		box-shadow: none;
	}

	@media (prefers-reduced-motion: no-preference) {
		.screen {
			transition: transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
		}
	}

	@media (hover: hover) and (prefers-reduced-motion: no-preference) {
		.screen:not(.flat):hover {
			transform: rotateX(2deg) rotateY(calc(var(--ry) * 0.4)) rotateZ(calc(var(--rz) * 0.4)) translateX(var(--sx))
				translateZ(28px);
		}
	}

	.thumb {
		grid-area: thumb;
		position: relative;
		aspect-ratio: 16 / 9;
		border-radius: 12px;
		overflow: hidden;
		background: linear-gradient(#3a3631 62%, #4a453f 62%);
		display: grid;
		place-items: center;
	}

	.thumb img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.dead .thumb img {
		filter: grayscale(1) brightness(0.85);
	}

	.meta {
		grid-area: meta;
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-2) 0;
		font-size: var(--size-label);
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-muted-on-light);
	}

	.status {
		margin-left: auto;
	}

	.status.dead {
		color: var(--color-status-dead);
	}

	.name {
		grid-area: name;
		padding: 0 var(--space-2);
		font-family: var(--font-display);
		font-size: clamp(20px, 1vw + 16px, 26px);
		line-height: 1.15;
		letter-spacing: -0.01em;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	/* Favoritos: a heart that stands off the monitor's corner in 3D. */
	.screen.has-heart {
		transform-style: preserve-3d;
	}

	.heart {
		position: absolute;
		top: -10px;
		right: -6px;
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--color-action-alert);
		color: var(--color-text-light);
		box-shadow: 0 6px 14px rgb(0 0 0 / 0.45);
		transform: translateZ(36px) rotate(12deg);
		pointer-events: none;
	}

	.flat .heart {
		transform: none;
	}
</style>

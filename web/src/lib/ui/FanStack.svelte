<script lang="ts">
	// Fanned thumbnails for a Library card (DESIGN §6). The CSS-3D composition is
	// the floor and always renders. On a capable device the first visible card also
	// loads the WebGL renderer (a separate chunk) and swaps to it once its textures
	// are drawn. Decorative; the card carries the name and count.
	import { onMount, type Component } from 'svelte';
	import { canUseWebGL3D, readEnv } from '#lib/capability.ts';
	import { isActive, setVisible } from './active3d.svelte.ts';

	let {
		items,
		id,
		order = 0
	}: { items: { thumbnail?: string }[]; id: string; order?: number } = $props();

	let host = $state<HTMLElement>();
	let capable = $state(false);
	let failed = $state(false);
	let ready = $state(false);
	let Scene = $state<Component<{
		items: { thumbnail?: string }[];
		onready: () => void;
		onfail: () => void;
	}> | null>(null);

	const active = $derived(capable && !failed && isActive(id));

	onMount(() => {
		capable = canUseWebGL3D(readEnv());
		if (!capable || !host) return;
		const io = new IntersectionObserver(([entry]) => setVisible(id, order, entry.isIntersecting), {
			threshold: 0.2
		});
		io.observe(host);
		return () => {
			io.disconnect();
			setVisible(id, order, false);
		};
	});

	// Fetch the 3D chunk only when this card is the one allowed to use WebGL, and
	// only when the browser is idle so it never competes with first paint.
	$effect(() => {
		if (!active || Scene) return;
		const load = () =>
			import('./FanStack3D.svelte')
				.then((m) => (Scene = m.default as typeof Scene))
				.catch(() => (failed = true));
		if ('requestIdleCallback' in window) {
			const h = requestIdleCallback(load, { timeout: 1500 });
			return () => cancelIdleCallback(h);
		}
		const t = setTimeout(load, 200);
		return () => clearTimeout(t);
	});

	$effect(() => {
		if (!active) ready = false;
	});

	// Back-left, back-right, front: the newest video sits in front.
	const slots = $derived([items[1], items[2], items[0]]);
	const names = ['left', 'right', 'front'];
</script>

<div class="fan" class:gl={ready} bind:this={host} aria-hidden="true">
	{#each slots as item, i (i)}
		<span class={`paper ${names[i]}`}>
			{#if item?.thumbnail}
				<img
					src={item.thumbnail}
					alt=""
					loading="lazy"
					referrerpolicy="no-referrer"
					onerror={(e) => ((e.currentTarget as HTMLElement).style.display = 'none')}
				/>
			{/if}
		</span>
	{/each}
	{#if active && Scene}
		<div class="gl-layer" class:on={ready}>
			<Scene {items} onready={() => (ready = true)} onfail={() => (failed = true)} />
		</div>
	{/if}
</div>

<style>
	.fan {
		--tilt: 16deg;
		position: relative;
		aspect-ratio: 16 / 10;
		perspective: 700px;
		perspective-origin: 50% 40%;
		transform-style: preserve-3d;
	}

	.paper {
		position: absolute;
		inset-block: 4% 4%;
		inset-inline-start: 50%;
		width: 34%;
		border-radius: var(--radius-thumb);
		overflow: hidden;
		background: #dcdcdc;
		box-shadow: 0 10px 22px rgb(0 0 0 / 0.18);
		transition: transform var(--motion-press);
		transform-origin: 50% 90%;
	}

	.left {
		transform: translateX(-118%) rotateZ(-7deg) rotateY(var(--tilt));
	}

	.right {
		transform: translateX(18%) rotateZ(7deg) rotateY(calc(var(--tilt) * -1));
	}

	.front {
		transform: translateX(-50%) translateZ(24px);
	}

	/* A little life on hover/focus; not with reduced motion. */
	@media (prefers-reduced-motion: no-preference) {
		:global(a.card:hover) .left,
		:global(a.card:focus-visible) .left {
			transform: translateX(-128%) rotateZ(-9deg) rotateY(var(--tilt));
		}

		:global(a.card:hover) .right,
		:global(a.card:focus-visible) .right {
			transform: translateX(28%) rotateZ(9deg) rotateY(calc(var(--tilt) * -1));
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.paper {
			transition: none;
		}
	}

	/* Once WebGL has drawn the same fan, hide the CSS one underneath. */
	.fan.gl .paper {
		opacity: 0;
	}

	.gl-layer {
		position: absolute;
		inset: 0;
		opacity: 0;
		transition: opacity 160ms;
		pointer-events: none;
	}

	.gl-layer.on {
		opacity: 1;
	}

	@media (prefers-reduced-motion: reduce) {
		.gl-layer {
			transition: none;
		}
	}

	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
</style>

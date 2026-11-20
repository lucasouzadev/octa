<script lang="ts">
	// Fanned thumbnails for a Library card (DESIGN §6). The CSS-3D composition is
	// the floor and always renders. On a capable device the first visible card also
	// loads the WebGL renderer (a separate chunk) and swaps to it once its textures
	// are drawn. Decorative; the card carries the name and count.
	import { onMount, type Component } from 'svelte';
	import { canUseWebGL3D, readEnv } from '#lib/capability.ts';
	import { cardLabel, fanCards, type FanItem } from '#lib/fan.ts';
	import { isActive, setVisible } from './active3d.svelte.ts';

	let {
		items,
		id,
		order = 0
	}: { items: FanItem[]; id: string; order?: number } = $props();

	let host = $state<HTMLElement>();
	let capable = $state(false);
	let failed = $state(false);
	let ready = $state(false);
	let Scene = $state<Component<{
		items: FanItem[];
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

	const cards = $derived(fanCards(items));
</script>

<div class="fan" class:gl={ready} bind:this={host} aria-hidden="true">
	{#each cards as c, i (i)}
		<span
			class="tile"
			class:vertical={c.vertical}
			style={`--x: ${c.x}; --r: ${c.rotZ}deg; --d: ${c.drop}; --ry: ${-c.rotZ * 1.2}deg; z-index: ${c.z}`}
		>
			{#if c.item?.thumbnail}
				<img
					src={c.item.thumbnail}
					alt=""
					loading="lazy"
					referrerpolicy="no-referrer"
					onerror={(e) => ((e.currentTarget as HTMLElement).style.display = 'none')}
				/>
			{:else if c.item?.author}
				<span class="cover">{c.item.author}</span>
			{/if}
			{#if c.item}<span class="tag">{cardLabel(c.item)}</span>{/if}
		</span>
	{/each}
	{#if active && Scene}
		<div class="gl-layer" class:on={ready}>
			<Scene {items} onready={() => (ready = true)} onfail={() => (failed = true)} />
		</div>
	{/if}
</div>

<style>
	/* Prototype page 2: bordered cards in a fan, name above, count below. */
	.fan {
		position: relative;
		aspect-ratio: 16 / 8.5;
		perspective: 900px;
		perspective-origin: 50% 40%;
	}

	.tile {
		position: absolute;
		inset-inline-start: calc(50% + var(--x) * 1%);
		top: calc(50% + var(--d) * 1%);
		width: 30%;
		aspect-ratio: 4 / 3;
		border: 1.5px solid #fff;
		border-radius: 14px;
		overflow: hidden;
		background: #cfcfcf;
		box-shadow: 8px -6px 16px rgb(0 0 0 / 0.16);
		transform: translate(-50%, -50%) rotate(var(--r)) rotateY(calc(var(--ry) + var(--tilt-x) * 10deg)) rotateX(calc(var(--tilt-y) * -8deg));
		transition: transform var(--motion-press);
	}

	.tile.vertical {
		width: 22%;
		aspect-ratio: 9 / 13;
	}

	.cover {
		position: absolute;
		inset: 50% 6px auto;
		transform: translateY(-50%);
		text-align: center;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-display);
		font-size: 13px;
		color: #3a3631;
	}

	.tag {
		position: absolute;
		inset: auto 0 0 0;
		padding: 18px 8px 6px;
		background: linear-gradient(to top, rgb(0 0 0 / 0.5), transparent);
		color: #fff;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	:global(html[data-tilt]) .tile {
		transition: none;
	}

	@media (prefers-reduced-motion: no-preference) {
		:global(a.card:hover) .tile,
		:global(a.card:focus-visible) .tile {
			transform: translate(-50%, -50%) rotate(calc(var(--r) * 1.3)) rotateY(var(--ry));
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.tile {
			transition: none;
		}
	}

	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	/* Once WebGL has drawn the same fan, hide the CSS one underneath. */
	.fan.gl .tile {
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
</style>

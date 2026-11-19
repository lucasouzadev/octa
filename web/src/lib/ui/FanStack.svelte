<script lang="ts">
	// Fanned thumbnails for a Library card (DESIGN §6). CSS-3D renderer: the floor
	// that always works. Decorative; the card carries the name and count.
	let { items }: { items: { thumbnail?: string }[] } = $props();
	// Back-left, back-right, front: the newest video sits in front.
	const slots = $derived([items[1], items[2], items[0]]);
	const names = ['left', 'right', 'front'];
</script>

<div class="fan" aria-hidden="true">
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

	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
</style>

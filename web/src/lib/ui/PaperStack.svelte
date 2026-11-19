<script lang="ts">
	// Paper stack for the Collection screen (DESIGN §6): up to three thumbnails piled
	// and tipped back (rotateX 14°). CSS-3D renderer; decorative.
	let { items }: { items: { thumbnail?: string }[] } = $props();
	const papers = $derived(items.slice(0, 3));
</script>

<div class="stack" aria-hidden="true">
	{#each papers as item, i (i)}
		<span class="paper" style={`--i: ${i}`}>
			{#if item.thumbnail}
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
	.stack {
		--tip: 14deg;
		position: relative;
		width: 168px;
		aspect-ratio: 3 / 4;
		margin-bottom: var(--space-6);
		perspective: 800px;
		perspective-origin: 50% 20%;
	}

	.paper {
		position: absolute;
		inset: 0;
		border-radius: var(--radius-paper);
		overflow: hidden;
		background: #2b2b2b;
		box-shadow: 0 14px 28px rgb(0 0 0 / 0.5);
		/* The first (newest) paper is on top; the others peek out above it. */
		transform: translateY(calc(var(--i) * -9%)) translateZ(calc(var(--i) * -18px))
			rotateX(var(--tip)) scale(calc(1 - var(--i) * 0.05));
		z-index: calc(10 - var(--i));
		filter: brightness(calc(1 - var(--i) * 0.18));
	}

	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
</style>

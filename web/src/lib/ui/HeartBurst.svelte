<script lang="ts">
	import { heartBurst, type Heart } from '#lib/hearts.ts';
	import Icon from '#lib/ui/Icon.svelte';

	// Hearts rise from the button each time `fire` goes up. Decorative (aria-hidden) and
	// skipped entirely under reduced motion. Each heart removes itself when it is done.
	let { fire }: { fire: number } = $props();

	let hearts = $state<(Heart & { id: number })[]>([]);
	let seen = 0;
	let nextId = 0;

	$effect(() => {
		if (fire === seen) return;
		seen = fire;
		if (fire === 0 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		for (const h of heartBurst(9, fire)) {
			const id = nextId++;
			hearts.push({ ...h, id });
			setTimeout(() => (hearts = hearts.filter((x) => x.id !== id)), h.delay + h.duration + 50);
		}
	});
</script>

<span class="hearts" aria-hidden="true">
	{#each hearts as h (h.id)}
		<span
			class="heart"
			style={`--dx: ${h.dx}px; --rot: ${h.rotate}deg; --size: ${h.size}px; animation-duration: ${h.duration}ms; animation-delay: ${h.delay}ms`}
		>
			<Icon name="heart" size={h.size} filled />
		</span>
	{/each}
</span>

<style>
	.hearts {
		position: absolute;
		inset: 0;
		pointer-events: none;
		overflow: visible;
	}

	.heart {
		position: absolute;
		left: 50%;
		top: 30%;
		margin-left: calc(var(--size) / -2);
		color: var(--color-action-alert);
		opacity: 0;
		animation: rise ease-out forwards;
	}

	@keyframes rise {
		0% {
			opacity: 0;
			transform: translate(0, 0) scale(0.6) rotate(0deg);
		}
		15% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translate(var(--dx), -180px) scale(1.15) rotate(var(--rot));
		}
	}
</style>

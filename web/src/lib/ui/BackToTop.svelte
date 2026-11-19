<script lang="ts">
	import { showBackToTop } from '#lib/backtop.ts';
	import Icon from '#lib/ui/Icon.svelte';

	// Floating arrow for long lists: smooth scroll to the top (instant under reduced motion).
	let { lift = 0, onDark = false }: { /** Extra px to sit above a bottom bar. */ lift?: number; onDark?: boolean } = $props();

	let visible = $state(false);

	function update() {
		visible = showBackToTop(window.scrollY, window.innerHeight);
	}

	function toTop() {
		const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
		window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
	}
</script>

<svelte:window onscroll={update} onresize={update} />

{#if visible}
	<button
		class="top"
		class:on-dark={onDark}
		type="button"
		aria-label="Voltar ao topo"
		style={`--lift: ${lift}px`}
		onclick={toTop}
	>
		<Icon name="up" size={22} />
	</button>
{/if}

<style>
	.top {
		position: fixed;
		z-index: 90;
		right: max(var(--space-4), env(safe-area-inset-right));
		bottom: calc(var(--space-5) + var(--lift) + env(safe-area-inset-bottom));
		width: 48px;
		height: 48px;
		display: grid;
		place-items: center;
		border: none;
		border-radius: 50%;
		background: var(--color-text-light);
		color: var(--color-text-dark);
		box-shadow: 0 2px 6px rgb(0 0 0 / 0.3), 0 8px 22px rgb(0 0 0 / 0.3);
		animation: top-in 180ms ease-out;
	}

	/* On dark screens the arrow flips to a light disc so it stays visible. */
	.top.on-dark {
		background: var(--color-text-dark);
		color: var(--color-text-light);
	}

	@keyframes top-in {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.top {
			animation: none;
		}
	}
</style>

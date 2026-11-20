<script lang="ts">
	import '@fontsource-variable/inter';
	import '@fontsource-variable/newsreader';
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import { onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { themeColorFor } from '#lib/screen.ts';
	import { theme } from '#lib/theme.svelte.ts';
	import { currentMode } from '#lib/transition.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// The color this screen paints, for the browser chrome and for the strip under the status bar.
	const screenColor = $derived(theme.override ?? themeColorFor(page.route.id));

	// Cross-fade the screen colors and morph the card thumbnail into the player
	// frame. No-op without View Transitions; reduced motion gets a short fade.
	onNavigate((navigation) => {
		const mode = currentMode();
		if (mode === 'none') return;
		const root = document.documentElement;
		root.dataset.vt = mode;
		return new Promise((resolve) => {
			const transition = document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
			transition.finished.finally(() => {
				delete root.dataset.vt;
				document.querySelectorAll<HTMLElement>('[data-vt-source]').forEach((el) => {
					el.style.viewTransitionName = '';
					delete el.dataset.vtSource;
				});
			});
		});
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" content={screenColor} />
</svelte:head>

<!-- Content that scrolls up under the clock and battery fades out here instead of mixing with them. -->
<div class="safe-top" aria-hidden="true" style={`--safe-bg: ${screenColor}`}></div>

{@render children()}

<style>
	.safe-top {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 80;
		height: calc(env(safe-area-inset-top) + 14px);
		background: linear-gradient(to bottom, var(--safe-bg) 0, var(--safe-bg) env(safe-area-inset-top), transparent 100%);
		pointer-events: none;
	}
</style>

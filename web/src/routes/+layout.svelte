<script lang="ts">
	import '@fontsource-variable/inter';
	import '@fontsource-variable/newsreader';
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import { onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { themeColorFor } from '#lib/screen.ts';
	import { currentMode } from '#lib/transition.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

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
	<meta name="theme-color" content={themeColorFor(page.route.id)} />
</svelte:head>

{@render children()}

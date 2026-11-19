export type TransitionMode = 'none' | 'fade' | 'full';

/** Which navigation transition to run (SPEC A6, DESIGN §7). */
export function transitionMode(env: { supported: boolean; reducedMotion: boolean }): TransitionMode {
	if (!env.supported) return 'none';
	return env.reducedMotion ? 'fade' : 'full';
}

/** Read the live browser environment. Only call in the browser. */
export function currentMode(): TransitionMode {
	return transitionMode({
		supported: typeof document.startViewTransition === 'function',
		reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches
	});
}

/**
 * Tap handler for a row or card that opens the player: names its thumbnail so it
 * can morph into the player frame. Only one element may hold the name, so it is
 * set on tap (the layout clears it when the transition ends).
 */
export function markSource(e: Event, selector: string): void {
	if (currentMode() !== 'full') return;
	const el = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(selector);
	if (!el) return;
	el.style.viewTransitionName = 'thumb';
	el.dataset.vtSource = '';
}

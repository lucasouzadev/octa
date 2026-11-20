<script lang="ts">
	import type { Snippet } from 'svelte';
	import { dragOffset, shouldDismiss } from '#lib/sheet.ts';

	// THE bottom sheet. Every sheet in the app uses this (sheet-rule.spec.ts enforces it):
	// handle, slide-up open, slide-down close, drag the handle or title down to close,
	// rubber band when pulled up, Esc and backdrop tap. Built on <dialog> for the focus
	// trap and the inert background.
	let {
		open,
		title,
		onclose,
		crown,
		children
	}: {
		open: boolean;
		title: string;
		onclose: () => void;
		/** Optional preview that sits on the top edge, half above the sheet (decoration only). */
		crown?: Snippet;
		children: Snippet;
	} = $props();

	let dialog = $state<HTMLDialogElement>();
	let panel = $state<HTMLElement>();
	let phase = $state<'closed' | 'open' | 'closing'>('closed');
	let offset = $state(0);
	let dragging = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
	const CLOSE_MS = 300;

	function show() {
		clearTimeout(timer);
		if (!dialog) return;
		if (!dialog.open) dialog.showModal();
		offset = 0;
		panel?.focus({ preventScroll: true });
		// Two frames so the browser paints the closed pose first and the slide can run.
		requestAnimationFrame(() => requestAnimationFrame(() => (phase = 'open')));
	}

	/** Slide out, then really close. `notify` is false when the parent already closed it. */
	function hide(notify: boolean) {
		if (!dialog?.open || phase === 'closing') return;
		phase = 'closing';
		offset = 0;
		clearTimeout(timer);
		timer = setTimeout(
			() => {
				dialog?.close();
				phase = 'closed';
				if (notify) onclose();
			},
			reduced() ? 0 : CLOSE_MS
		);
	}

	$effect(() => {
		if (!dialog) return;
		if (open) show();
		else hide(false);
	});

	let startY = 0;
	let lastY = 0;
	let lastT = 0;
	let velocity = 0;

	function down(e: PointerEvent) {
		if (e.button !== 0 || phase !== 'open') return;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		dragging = true;
		startY = lastY = e.clientY;
		lastT = e.timeStamp;
		velocity = 0;
	}

	function move(e: PointerEvent) {
		if (!dragging) return;
		const dt = e.timeStamp - lastT;
		if (dt > 0) velocity = (e.clientY - lastY) / dt;
		lastY = e.clientY;
		lastT = e.timeStamp;
		offset = dragOffset(e.clientY - startY);
	}

	function up() {
		if (!dragging) return;
		dragging = false;
		if (shouldDismiss(offset, panel?.offsetHeight ?? 0, velocity)) hide(true);
		else offset = 0;
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog
	bind:this={dialog}
	class="sheet on-dark"
	data-state={phase}
	aria-label={title}
	oncancel={(e) => {
		e.preventDefault();
		hide(true);
	}}
	onclick={(e) => {
		if (e.target === dialog) hide(true);
	}}
>
	<div class="rise" class:dragging style={`--drag: ${offset}px`}>
		<!-- Outside the panel: the panel scrolls, and a scroll area would clip the half above the edge. -->
		{#if crown}<div class="crown" aria-hidden="true">{@render crown()}</div>{/if}
		<div class="panel" class:crowned={!!crown} bind:this={panel} tabindex="-1">
			<div
				class="grab"
				role="presentation"
				onpointerdown={down}
				onpointermove={move}
				onpointerup={up}
				onpointercancel={up}
			>
				<span class="handle"></span>
				<h2>{title}</h2>
			</div>
			<div class="body">{@render children()}</div>
		</div>
	</div>
</dialog>

<style>
	.sheet {
		border: none;
		padding: 0;
		margin: auto auto 0;
		width: 100%;
		max-width: var(--layout-content-max);
		max-height: none;
		background: transparent;
		color: var(--color-text-dark);
		overflow: visible;
	}

	.sheet::backdrop {
		background: rgb(0 0 0 / 0);
		transition: background 300ms ease-out;
	}

	.sheet[data-state='open']::backdrop {
		background: rgb(0 0 0 / 0.6);
	}

	/* Moves as one: the panel and the crown slide and drag together. */
	.rise {
		position: relative;
		--crown-half: 56px;
		transform: translateY(calc(100% + var(--drag)));
		transition: transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1);
		will-change: transform;
	}

	.sheet[data-state='open'] .rise {
		transform: translateY(var(--drag));
	}

	.rise.dragging {
		transition: none;
	}

	.panel {
		background: var(--color-surface-dark);
		border-radius: var(--radius-card) var(--radius-card) 0 0;
		padding: 0 var(--space-5) calc(var(--space-6) + env(safe-area-inset-bottom));
		max-height: 85dvh;
		overflow-y: auto;
		overscroll-behavior: contain;
		outline: none;
	}

	/* The lower half of the crown lives inside the sheet: leave room so nothing sits under it. */
	.panel.crowned {
		padding-top: var(--crown-half);
	}

	/* A 200x112 preview centered on the top edge. */
	.crown {
		position: absolute;
		z-index: 1;
		top: 0;
		left: 50%;
		translate: -50% -50%;
		pointer-events: none;
	}

	/* Generous grab zone: the handle and the title both drag. */
	.grab {
		touch-action: none;
		cursor: grab;
		padding: var(--space-3) var(--space-2) var(--space-2);
		margin-inline: calc(var(--space-5) * -1);
		padding-inline: calc(var(--space-5) + var(--space-2));
	}

	.handle {
		display: block;
		width: 40px;
		height: 5px;
		margin: 0 auto var(--space-4);
		border-radius: 3px;
		background: var(--color-muted-hint-on-dark);
	}

	h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: var(--size-h2);
		letter-spacing: -0.01em;
		padding-bottom: var(--space-2);
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	@media (prefers-reduced-motion: reduce) {
		.sheet::backdrop,
		.rise {
			transition: none;
		}
	}
</style>

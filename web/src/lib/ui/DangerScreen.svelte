<script lang="ts">
	import type { Snippet } from 'svelte';
	import { splitMark } from '#lib/danger.ts';
	import { theme } from '#lib/theme.svelte.ts';

	// The orange full-screen moment (DESIGN: "Dead link", action.alert) used for every
	// remove: delete a link, delete a collection, and a link that went offline. One color
	// edge to edge, a headline, one sentence, two actions. Escape or Cancel leaves.
	let {
		title,
		body,
		confirmLabel,
		cancelLabel = 'Cancelar',
		busy = false,
		error = '',
		thumb,
		visual,
		mark,
		onconfirm,
		oncancel
	}: {
		title: string;
		body: string;
		confirmLabel: string;
		cancelLabel?: string;
		busy?: boolean;
		error?: string;
		/** The cover of what is about to go, clear and tilted. */
		thumb?: string;
		/** What is about to go, drawn above the words (a fan of covers, an illustration). */
		visual?: Snippet;
		/** A part of the title to paint with a marker pen (the name of the collection). */
		mark?: string;
		onconfirm: () => void;
		oncancel: () => void;
	} = $props();

	let cancel = $state<HTMLButtonElement>();
	const parts = $derived(splitMark(title, mark));

	$effect(() => {
		theme.override = '#FF6A2B'; // color.action.alert
		const previous = document.activeElement as HTMLElement | null;
		cancel?.focus({ preventScroll: true });
		return () => {
			theme.override = null;
			previous?.focus?.({ preventScroll: true });
		};
	});
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && !busy && oncancel()} />

<div class="danger on-alert" role="alertdialog" aria-modal="true" aria-labelledby="danger-title" aria-describedby="danger-body">
	{#if thumb}<img class="thumb" src={thumb} alt="" />{/if}
	{#if visual}<div class="visual" aria-hidden="true">{@render visual()}</div>{/if}
	<div class="copy">
		<h1 id="danger-title">{parts[0]}{#if parts[1]}<mark>{parts[1]}</mark>{parts[2]}{/if}</h1>
		<p id="danger-body">{body}</p>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
	</div>
	<div class="actions">
		<button class="confirm" type="button" disabled={busy} onclick={onconfirm}>{busy ? 'Aguarde…' : confirmLabel}</button>
		<button class="cancel" type="button" bind:this={cancel} disabled={busy} onclick={oncancel}>{cancelLabel}</button>
	</div>
</div>

<style>
	.danger {
		position: fixed;
		inset: 0;
		z-index: 300;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		gap: var(--space-6);
		padding: calc(var(--space-6) + env(safe-area-inset-top)) var(--screen-pad)
			calc(var(--space-7) + env(safe-area-inset-bottom));
		background: var(--color-action-alert);
		color: var(--color-text-light);
		animation: rise 220ms ease-out;
		overflow: hidden;
	}

	/* The cover is shown as it is: clear, big, a little tilted. Nothing tints it. */
	.thumb {
		position: absolute;
		top: calc(12% + env(safe-area-inset-top));
		left: 50%;
		width: min(84%, 420px);
		aspect-ratio: 16 / 9;
		object-fit: cover;
		border-radius: 18px;
		box-shadow: 0 10px 30px rgb(0 0 0 / 0.28);
		transform: translateX(-50%) rotate(-6deg);
	}

	/* Same place as the single cover: upper part, centered, above the words. */
	.visual {
		position: absolute;
		top: calc(10% + env(safe-area-inset-top));
		left: 50%;
		width: min(88%, 420px);
		translate: -50% 0;
		display: grid;
		place-items: center;
		color: var(--color-text-light);
	}

	.copy,
	.actions {
		position: relative;
		width: 100%;
		max-width: var(--layout-content-max);
		margin-inline: auto;
	}

	h1 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(36px, 9vw, 56px);
		line-height: 1.05;
		text-wrap: balance;
	}

	/* A highlighter stroke over the lower part of the name, not a box. */
	mark {
		color: var(--color-text-light);
		background: linear-gradient(transparent 12%, var(--color-highlight-marker) 12%, var(--color-highlight-marker) 92%, transparent 92%);
		padding: 0 0.12em;
		margin: 0 -0.04em;
		border-radius: 0.12em;
		-webkit-box-decoration-break: clone;
		box-decoration-break: clone;
	}

	p {
		margin-top: var(--space-3);
		font-size: var(--size-body);
		line-height: 1.45;
		max-width: 34ch;
	}

	.error {
		font-weight: 700;
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.actions button {
		height: 60px;
		border: none;
		border-radius: var(--radius-pill);
		font-size: var(--size-body);
		font-weight: 600;
	}

	.confirm {
		background: var(--color-text-light);
		color: var(--color-text-dark);
	}

	.cancel {
		background: rgb(0 0 0 / 0.1);
		color: var(--color-text-light);
	}

	.actions button:disabled {
		opacity: 0.6;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(24px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.danger {
			animation: none;
		}
	}
</style>

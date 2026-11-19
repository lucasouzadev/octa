<script lang="ts">
	import type { Snippet } from 'svelte';

	// Bottom sheet on the native <dialog>: focus trap, Esc and inert background for free.
	let {
		open,
		title,
		onclose,
		children
	}: { open: boolean; title: string; onclose: () => void; children: Snippet } = $props();

	let dialog = $state<HTMLDialogElement>();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog
	bind:this={dialog}
	class="sheet on-dark"
	aria-label={title}
	onclose={onclose}
	onclick={(e) => {
		if (e.target === dialog) onclose();
	}}
>
	<div class="panel">
		<h2>{title}</h2>
		{@render children()}
	</div>
</dialog>

<style>
	.sheet {
		border: none;
		padding: 0;
		margin: auto auto 0;
		width: 100%;
		max-width: var(--layout-content-max);
		background: transparent;
		color: var(--color-text-dark);
	}

	.sheet::backdrop {
		background: rgb(0 0 0 / 0.6);
	}

	.panel {
		background: var(--color-surface-dark);
		border-radius: var(--radius-card) var(--radius-card) 0 0;
		padding: var(--space-6) var(--space-5) calc(var(--space-6) + env(safe-area-inset-bottom));
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: var(--size-h2);
		letter-spacing: -0.01em;
		padding: 0 var(--space-2) var(--space-2);
	}
</style>

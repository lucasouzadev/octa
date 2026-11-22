<script lang="ts">
	import { toast } from '#lib/toast.svelte.ts';
</script>

<!-- Always mounted so screen readers pick the text up when it changes. Takes a tap only while it carries a button. -->
<div class="box banner" class:shown={toast.text !== ''} class:tappable={toast.action !== undefined}>
	<p class="toast" class:shown={toast.text !== ''} role="status" aria-live="polite">{toast.text}</p>
	{#if toast.action}
		<button type="button" class="act" onclick={() => toast.act()}>{toast.action.label}</button>
	{/if}
</div>

<style>
	/* R5.4: an in-app notification banner, full width under the status bar, not a pill. */
	.box {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		position: fixed;
		z-index: 120;
		top: calc(env(safe-area-inset-top) + var(--space-2));
		left: var(--space-3);
		right: var(--space-3);
		margin: 0;
		padding: var(--space-3) var(--space-4);
		border-radius: 16px;
		/* Black with a light edge: it reads on the white Library and on the dark screens alike. */
		background: var(--color-text-light);
		color: var(--color-text-dark);
		border: 1px solid rgb(255 255 255 / 0.28);
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.35);
		font-size: var(--size-body);
		font-weight: 600;
		text-align: left;
		pointer-events: none;
		opacity: 0;
		visibility: hidden;
		translate: 0 -24px;
		transition:
			opacity 180ms ease-out,
			translate 180ms ease-out,
			visibility 0s linear 180ms;
	}

	.box.tappable.shown {
		pointer-events: auto;
	}

	.toast {
		margin: 0;
	}

	.act {
		min-height: 32px;
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-pill);
		background: var(--color-text-dark);
		color: var(--color-text-light);
		font: inherit;
		cursor: pointer;
	}

	.box.shown {
		opacity: 1;
		visibility: visible;
		translate: 0 0;
		transition-delay: 0s;
	}

	@media (prefers-reduced-motion: reduce) {
		.box {
			transition: none;
		}
	}
</style>

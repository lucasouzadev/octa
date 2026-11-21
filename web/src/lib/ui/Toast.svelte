<script lang="ts">
	import { toast } from '#lib/toast.svelte.ts';
</script>

<!-- Always mounted so screen readers pick the text up when it changes. Takes a tap only while it carries a button. -->
<div class="box" class:shown={toast.text !== ''} class:tappable={toast.action !== undefined}>
	<p class="toast" class:shown={toast.text !== ''} role="status" aria-live="polite">{toast.text}</p>
	{#if toast.action}
		<button type="button" class="act" onclick={() => toast.act()}>{toast.action.label}</button>
	{/if}
</div>

<style>
	.box {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		position: fixed;
		z-index: 120;
		left: 50%;
		/* Like an in-app banner: just under the status bar, dropping in from above. */
		top: calc(env(safe-area-inset-top) + var(--space-3));
		width: max-content;
		max-width: calc(100% - var(--space-5) * 2);
		margin: 0;
		padding: var(--space-3) var(--space-5);
		border-radius: var(--radius-pill);
		/* Black with a light edge: it reads on the white Library and on the dark screens alike. */
		background: var(--color-text-light);
		color: var(--color-text-dark);
		border: 1px solid rgb(255 255 255 / 0.28);
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.35);
		font-size: var(--size-body);
		font-weight: 600;
		text-align: center;
		pointer-events: none;
		opacity: 0;
		visibility: hidden;
		translate: -50% -16px;
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
		translate: -50% 0;
		transition-delay: 0s;
	}

	@media (prefers-reduced-motion: reduce) {
		.box {
			transition: none;
		}
	}
</style>

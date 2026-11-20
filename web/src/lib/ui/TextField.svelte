<script lang="ts">
	import Icon from '#lib/ui/Icon.svelte';

	// The text field of the blue "create" screens: it stays in the page, the browser decides
	// how to show it above the keyboard. White on blue, an underline, an optional "Colar"
	// button on the same row, and the hint or the error right under it.
	let {
		id,
		label,
		value = $bindable(''),
		placeholder = '',
		type = 'text',
		inputmode,
		maxlength,
		autocapitalize,
		spellcheck,
		hint = '',
		error = '',
		busy = false,
		onpaste
	}: {
		id: string;
		label: string;
		value: string;
		placeholder?: string;
		type?: 'text' | 'url';
		inputmode?: 'url' | 'text';
		maxlength?: number;
		autocapitalize?: 'off' | 'sentences';
		spellcheck?: boolean;
		hint?: string;
		error?: string;
		busy?: boolean;
		/** Adds a "Colar" button that calls this. */
		onpaste?: () => void | Promise<void>;
	} = $props();
</script>

<div class="field">
	<label class="label" for={id}>{label}</label>
	<div class="row">
		<input
			{id}
			bind:value
			{type}
			{inputmode}
			{maxlength}
			{placeholder}
			{autocapitalize}
			{spellcheck}
			autocomplete="off"
			enterkeyhint="go"
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
		/>
		{#if onpaste}
			<button class="paste" type="button" onclick={() => onpaste?.()} disabled={busy}>
				<Icon name="paste" size={18} />
				Colar
			</button>
		{/if}
	</div>
	{#if error}
		<p id="{id}-error" class="error" role="alert">{error}</p>
	{:else if hint}
		<p id="{id}-hint" class="hint">{hint}</p>
	{/if}
</div>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	input {
		flex: 1;
		min-width: 0;
		background: transparent;
		border: none;
		border-bottom: 2px solid rgb(255 255 255 / 0.5);
		border-radius: 0;
		padding: var(--space-3) 0 var(--space-4);
		font-size: 22px;
		color: var(--color-text-dark);
		outline: none;
	}

	input::placeholder {
		color: rgb(255 255 255 / 0.72);
	}

	input:focus-visible {
		border-bottom-color: var(--color-text-dark);
	}

	.paste {
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		height: 40px;
		padding: 0 var(--space-4);
		border: none;
		border-radius: var(--radius-pill);
		background: rgb(255 255 255 / 0.2);
		color: var(--color-text-dark);
		font-weight: 600;
		font-size: var(--size-meta);
	}

	.paste:disabled {
		opacity: 0.5;
	}

	.hint,
	.error {
		font-size: var(--size-meta);
		line-height: 1.4;
		color: rgb(255 255 255 / 0.88);
	}

	.error {
		color: var(--color-text-dark);
		font-weight: 600;
	}
</style>

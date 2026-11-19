<script lang="ts">
	import { keyboardInset } from '#lib/keyboard.ts';
	import Icon from '#lib/ui/Icon.svelte';

	// A text field that, while being typed in, docks to the bottom edge right above the
	// on-screen keyboard. The page never scrolls or moves: only this bar comes forward,
	// over a light dim. Tap outside closes it and keeps the text; Enter or the send icon
	// sends. Works the same in Safari, an installed PWA and (with the Keyboard plugin
	// reporting the same visualViewport numbers) Capacitor.
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
		sendLabel = 'Enviar',
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
		sendLabel?: string;
		/** Adds a "Colar" button that calls this. */
		onpaste?: () => void | Promise<void>;
	} = $props();

	let docked = $state(false);
	let inset = $state(0);
	let shift = $state(0);
	let slotHeight = $state(0);
	let input = $state<HTMLInputElement>();
	let wrap = $state<HTMLElement>();
	let field = $state<HTMLElement>();

	function measure() {
		const vv = window.visualViewport;
		inset = vv ? keyboardInset(vv, window.innerHeight) : 0;
		shift = vv ? Math.round(vv.offsetTop) : 0;
	}

	function dock() {
		// Only touch devices have an on-screen keyboard to dock to; with a mouse the
		// field stays where it is.
		if (!matchMedia('(pointer: coarse)').matches) return;
		// Remember how tall the field is in the page so the page does not jump when it leaves.
		if (!docked && field) slotHeight = field.offsetHeight;
		measure();
		docked = true;
	}

	function undock() {
		docked = false;
	}

	// While docked: follow the keyboard, freeze the page, and close on a tap outside.
	$effect(() => {
		if (!docked) return;
		const vv = window.visualViewport;
		vv?.addEventListener('resize', measure);
		vv?.addEventListener('scroll', measure);
		const root = document.documentElement;
		const before = root.style.overflow;
		root.style.overflow = 'hidden';
		const outside = (e: PointerEvent) => {
			if (wrap && !wrap.contains(e.target as Node)) input?.blur();
		};
		document.addEventListener('pointerdown', outside, true);
		return () => {
			vv?.removeEventListener('resize', measure);
			vv?.removeEventListener('scroll', measure);
			root.style.overflow = before;
			document.removeEventListener('pointerdown', outside, true);
		};
	});

	// Buttons in the bar must not take focus from the field, or the keyboard would close
	// and the bar would move before the tap lands.
	const keepFocus = (e: PointerEvent) => e.preventDefault();
</script>

<div class="slot" bind:this={wrap} style={docked ? `min-height: ${slotHeight}px` : undefined}>
	{#if docked}<div class="dim" aria-hidden="true"></div>{/if}
	<div
		class="field"
		class:docked
		bind:this={field}
		style={docked ? `bottom: ${inset}px; transform: translateY(${shift}px)` : undefined}
		onfocusin={dock}
		onfocusout={(e) => {
			if (!wrap?.contains(e.relatedTarget as Node | null)) undock();
		}}
	>
		<label class="label" for={id}>{label}</label>
		<div class="row">
			<input
				{id}
				bind:this={input}
				bind:value
				{type}
				{inputmode}
				{maxlength}
				{placeholder}
				{autocapitalize}
				{spellcheck}
				autocomplete="off"
				enterkeyhint="send"
				aria-invalid={error ? 'true' : undefined}
				aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
				onkeydown={(e) => e.key === 'Escape' && input?.blur()}
			/>
			{#if onpaste}
				<button class="paste" type="button" onpointerdown={keepFocus} onclick={() => onpaste?.()} disabled={busy}>
					<Icon name="paste" size={18} />
					Colar
				</button>
			{/if}
			<button
				class="send"
				type="submit"
				aria-label={sendLabel}
				onpointerdown={keepFocus}
				disabled={busy || !value.trim()}
			>
				<Icon name="send" size={20} />
			</button>
		</div>
		{#if error}
			<p id="{id}-error" class="error" role="alert">{error}</p>
		{:else if hint && !docked}
			<p id="{id}-hint" class="hint">{hint}</p>
		{/if}
	</div>
</div>

<style>
	.slot {
		position: relative;
	}

	.dim {
		position: fixed;
		inset: 0;
		z-index: 40;
		background: rgb(0 0 0 / 0.28);
		pointer-events: none;
		animation: dim-in 200ms ease-out;
	}

	@keyframes dim-in {
		from {
			opacity: 0;
		}
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		transition: background 160ms ease-out;
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

	/* The send icon only exists while docked; the page has its own button otherwise. */
	.send {
		display: none;
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

	/* Docked: a white bar fixed right above the keyboard. */
	.field.docked {
		position: fixed;
		left: 0;
		right: 0;
		z-index: 50;
		width: 100%;
		max-width: var(--layout-content-max);
		margin-inline: auto;
		padding: var(--space-3) var(--space-4) calc(var(--space-3) + env(safe-area-inset-bottom));
		gap: var(--space-2);
		background: var(--color-bg-light);
		color: var(--color-text-light);
		border-radius: 22px 22px 0 0;
		box-shadow: 0 -8px 32px rgb(0 0 0 / 0.25);
	}

	.field.docked .label {
		color: var(--color-action-create);
		padding-inline: var(--space-2);
	}

	.field.docked input {
		background: var(--color-surface-light);
		color: var(--color-text-light);
		border: none;
		border-radius: 14px;
		padding: var(--space-3) var(--space-4);
		font-size: 18px;
	}

	.field.docked input::placeholder {
		color: var(--color-muted-on-light);
	}

	.field.docked .paste {
		background: var(--color-surface-light-button);
		color: var(--color-text-light);
	}

	.field.docked .send {
		flex: none;
		display: inline-grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: none;
		border-radius: 50%;
		background: var(--color-action-create);
		color: var(--color-text-dark);
	}

	.field.docked .send:disabled {
		opacity: 0.35;
	}

	.field.docked .error {
		color: var(--color-status-dead);
		padding-inline: var(--space-2);
	}

	@media (prefers-reduced-motion: reduce) {
		.dim {
			animation: none;
		}
		.field {
			transition: none;
		}
	}
</style>

<script lang="ts">
	import { SORT_MODES, type SortMode } from '#lib/organize.ts';
	import { disableTilt, enableTilt, tilt } from '#lib/tilt.svelte.ts';
	import Sheet from '#lib/ui/Sheet.svelte';

	// "Organizar": how the Library lists the collections, plus the switch that makes the 3D
	// objects follow the phone. Reordering by hand happens on the Library itself (the sheet
	// only starts it).
	let {
		open,
		mode,
		canOrder,
		onmode,
		onreorder,
		onclose
	}: {
		open: boolean;
		mode: SortMode;
		/** Two or more collections of the person's own: fewer have nothing to order. */
		canOrder: boolean;
		onmode: (mode: SortMode) => void;
		onreorder: () => void;
		onclose: () => void;
	} = $props();

	async function toggleTilt() {
		if (tilt.enabled) disableTilt();
		else await enableTilt();
	}
</script>

<Sheet {open} title="Organizar" {onclose}>
	{#if canOrder}
		<div class="group" role="radiogroup" aria-label="Ordenar coleções por">
			{#each SORT_MODES as m (m.mode)}
				<button class="option" type="button" role="radio" aria-checked={mode === m.mode} onclick={() => onmode(m.mode)}>
					{m.label}
				</button>
			{/each}
		</div>
		<button class="option solid" type="button" onclick={onreorder}>Reordenar coleções</button>
	{/if}
	{#if tilt.supported}
		<button
			class="option"
			type="button"
			role="switch"
			aria-checked={tilt.enabled}
			aria-label="Mover com o celular"
			title={tilt.denied ? 'Sem permissão do sensor de movimento' : undefined}
			onclick={toggleTilt}
		>
			<span>Mover com o celular</span>
			<span class="state" aria-hidden="true">{tilt.enabled ? 'Ligado' : 'Desligado'}</span>
		</button>
	{/if}
	{#if !canOrder && !tilt.supported}
		<p class="empty">Crie duas coleções para poder ordená-las.</p>
	{/if}
</Sheet>

<style>
	.group {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		min-height: 56px;
		padding: 0 var(--space-5);
		border: 2px solid transparent;
		border-radius: var(--radius-pill);
		background: var(--color-surface-dark-raised);
		color: var(--color-text-dark);
		font-size: var(--size-body);
		font-weight: 600;
		text-align: left;
	}

	/* The chosen way of ordering, and the switch when on: the inverted ring the app uses. */
	.option[aria-checked='true'] {
		border-color: var(--color-text-dark);
	}

	.option.solid {
		background: var(--color-text-dark);
		color: var(--color-text-light);
	}

	.state {
		font-size: var(--size-meta);
		color: var(--color-muted-on-dark);
	}

	.empty {
		color: var(--color-muted-on-dark);
		padding: 0 var(--space-2);
	}
</style>

<script lang="ts">
	import { SORT_MODES, type SortMode } from '#lib/organize.ts';
	import { disableTilt, enableTilt, tilt } from '#lib/tilt.svelte.ts';
	import Sheet from '#lib/ui/Sheet.svelte';

	// Two pages (R5.2). "Organizar": how the Library lists the collections and a way to reorder
	// them by hand (the sheet only starts it). "Dados": export, import and the switch that makes
	// the 3D objects follow the phone.
	let {
		open,
		mode,
		canOrder,
		onmode,
		onreorder,
		onexport,
		onimport,
		onclose
	}: {
		open: boolean;
		mode: SortMode;
		/** Two or more collections of the person's own: fewer have nothing to order. */
		canOrder: boolean;
		onmode: (mode: SortMode) => void;
		onreorder: () => void;
		onexport: () => void;
		onimport: (file: File) => void;
		onclose: () => void;
	} = $props();

	let picker = $state<HTMLInputElement>();
	type Page = 'organize' | 'data';
	let page = $state<Page>('organize');

	// Every opening starts on the first page.
	$effect(() => {
		if (!open) page = 'organize';
	});

	function picked(e: Event & { currentTarget: HTMLInputElement }) {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = ''; // the same file can be chosen again
		if (file) onimport(file);
	}

	async function toggleTilt() {
		if (tilt.enabled) disableTilt();
		else await enableTilt();
	}
</script>

<Sheet {open} title="Organizar" {onclose}>
	<div class="tabs" role="tablist" aria-label="Páginas">
		<button class="tab" type="button" role="tab" id="org-tab-organize" aria-selected={page === 'organize'} aria-controls="org-page" onclick={() => (page = 'organize')}>Organizar</button>
		<button class="tab" type="button" role="tab" id="org-tab-data" aria-selected={page === 'data'} aria-controls="org-page" onclick={() => (page = 'data')}>Dados</button>
	</div>
	<div id="org-page" class="page" role="tabpanel" aria-labelledby={page === 'organize' ? 'org-tab-organize' : 'org-tab-data'}>
		{#if page === 'organize'}
			{#if canOrder}
				<div class="group" role="radiogroup" aria-label="Ordenar coleções por">
					{#each SORT_MODES as m (m.mode)}
						<button class="option" type="button" role="radio" aria-checked={mode === m.mode} onclick={() => onmode(m.mode)}>
							{m.label}
						</button>
					{/each}
				</div>
				<button class="option solid" type="button" onclick={onreorder}>Reordenar coleções</button>
			{:else}
				<p class="note">Precisa de pelo menos duas telas para ordenar.</p>
			{/if}
		{:else}
			<button class="option" type="button" onclick={onexport}>Exportar biblioteca</button>
			<button class="option" type="button" onclick={() => picker?.click()}>Importar arquivo</button>
			<input bind:this={picker} class="file" type="file" accept="application/json,.json" aria-label="Arquivo da biblioteca" onchange={picked} />
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
		{/if}
	</div>
</Sheet>

<style>
	.tabs {
		display: flex;
		gap: var(--space-2);
		padding: var(--space-1);
		border-radius: var(--radius-pill);
		background: var(--color-surface-dark-raised);
	}

	.tab {
		flex: 1;
		min-height: 44px;
		border: 0;
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--color-muted-on-dark);
		font-size: var(--size-body);
		font-weight: 600;
	}

	.tab[aria-selected='true'] {
		background: var(--color-text-dark);
		color: var(--color-text-light);
	}

	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.note {
		margin: 0;
		color: var(--color-muted-on-dark);
		font-size: var(--size-meta);
	}

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

	.file {
		display: none;
	}
</style>

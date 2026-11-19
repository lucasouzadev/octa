<script lang="ts">
	import { CollectionError, library, type Collection, type Video } from '#lib/db/index.ts';
	import Sheet from '#lib/ui/Sheet.svelte';

	// "Mover para": the one place a video changes collection (collection screen and player).
	// The sheet stays open until the write is committed: closing first let a quick
	// navigation abort the IndexedDB transaction and lose the move.
	let {
		video,
		onclose,
		onmoved
	}: {
		video: Video | null;
		onclose: () => void;
		/** Called after the write is committed, with the new collection id (null = none). */
		onmoved: (target: string | null) => void;
	} = $props();

	let collections = $state<Collection[]>([]);
	let error = $state('');
	let busy = false;

	$effect(() => {
		if (!video) return;
		error = '';
		library().then(async (lib) => (collections = await lib.listCollections()));
	});

	const here = $derived(video ? collections.find((c) => c.order.includes(video.id)) : undefined);

	async function moveTo(target: string | null) {
		if (!video || busy) return;
		busy = true;
		try {
			await (await library()).moveVideo(video.id, target);
			onclose();
			onmoved(target);
		} catch (e) {
			error = e instanceof CollectionError ? 'Algo mudou. Atualize e tente de novo.' : 'Não deu para salvar agora.';
		} finally {
			busy = false;
		}
	}
</script>

<Sheet open={video !== null} title="Mover para" {onclose}>
	{#if video}
		{#each collections as c (c.id)}
			<button class="option" type="button" disabled={here?.id === c.id} onclick={() => moveTo(c.id)}>
				{c.name}{here?.id === c.id ? ' · está aqui' : ''}
			</button>
		{/each}
		{#if here}
			<button class="option" type="button" onclick={() => moveTo(null)}>Tirar da coleção</button>
		{/if}
		{#if collections.length === 0}
			<p class="empty">Você ainda não tem coleções.</p>
			<a class="option" href="/c/new">Criar coleção</a>
		{/if}
		{#if error}<p class="error" role="alert">{error}</p>{/if}
	{/if}
</Sheet>

<style>
	.option {
		display: flex;
		align-items: center;
		width: 100%;
		min-height: 56px;
		padding: 0 var(--space-5);
		border: none;
		border-radius: var(--radius-pill);
		background: var(--color-surface-dark-raised);
		color: var(--color-text-dark);
		font-size: var(--size-body);
		font-weight: 600;
		text-align: left;
		text-decoration: none;
	}

	.option:disabled {
		opacity: 0.5;
	}

	.empty {
		color: var(--color-muted-on-dark);
		padding: 0 var(--space-2);
	}

	.error {
		color: var(--color-action-alert);
		font-size: var(--size-meta);
		font-weight: 600;
		padding: 0 var(--space-2);
	}
</style>

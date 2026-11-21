<script lang="ts">
	import { toast } from '#lib/toast.svelte.ts';
	import { CollectionError, library, type Collection, type Video } from '#lib/db/index.ts';
	import { loadMode, sortCollections } from '#lib/organize.ts';
	import Sheet from '#lib/ui/Sheet.svelte';

	// "Mover para": the one place a video changes collection (collection screen and player).
	// The sheet stays open until the write is committed: closing first let a quick
	// navigation abort the IndexedDB transaction and lose the move.
	let {
		video,
		many = [],
		onclose,
		onmoved
	}: {
		video: Video | null;
		/** Several videos at once (R4.5): when given, they are moved together and `video` is ignored. */
		many?: Video[];
		onclose: () => void;
		/** Called after the write is committed, with the new collection id (null = none). */
		onmoved: (target: string | null) => void;
	} = $props();

	let collections = $state<Collection[]>([]);
	let error = $state('');
	let busy = false;

	const targets = $derived(many.length ? many : video ? [video] : []);

	$effect(() => {
		if (!targets.length) return;
		error = '';
		library().then(async (lib) => (collections = sortCollections(await lib.listCollections(), loadMode())));
	});

	const here = $derived(targets.length === 1 ? collections.find((c) => c.order.includes(targets[0].id)) : undefined);

	async function moveTo(target: string | null) {
		if (!targets.length || busy) return;
		busy = true;
		try {
			const lib = await library();
			const name = collections.find((c) => c.id === target)?.name;
			if (targets.length === 1) {
				await lib.moveVideo(targets[0].id, target);
				toast.show(name ? `Movido para ${name}` : 'Tirado da coleção');
			} else {
				await lib.moveVideos(
					targets.map((v) => v.id),
					target
				);
				toast.show(name ? `${targets.length} vídeos movidos para ${name}` : `${targets.length} vídeos tirados da coleção`);
			}
			onclose();
			onmoved(target);
		} catch (e) {
			error = e instanceof CollectionError ? 'Algo mudou. Atualize e tente de novo.' : 'Não deu para salvar agora.';
		} finally {
			busy = false;
		}
	}
</script>

<Sheet open={targets.length > 0} title="Mover para" {onclose}>
	{#snippet crown()}
		{#if targets.length}
			<div class="preview">
				{#if targets[0].thumbnail}
					<img src={targets[0].thumbnail} alt={targets[0].title} referrerpolicy="no-referrer" />
				{:else}
					<span class="blank"></span>
				{/if}
			</div>
		{/if}
	{/snippet}
	{#if targets.length}
		{#each collections as c (c.id)}
			<button class="option" type="button" disabled={here?.id === c.id} onclick={() => moveTo(c.id)}>
				{c.name}{here?.id === c.id ? ' · está aqui' : ''}
			</button>
		{/each}
		{#if here || targets.length > 1}
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
	/* The cover of the video being moved, tilted like the screens in the Library. */
	.preview {
		width: 200px;
		height: 112px;
		border-radius: var(--radius-thumb, 14px);
		overflow: hidden;
		background: var(--color-surface-dark-raised);
		border: 2px solid var(--color-text-dark);
		box-shadow: 0 12px 28px rgb(0 0 0 / 0.5);
		rotate: -3deg;
	}

	.preview img,
	.blank {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

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

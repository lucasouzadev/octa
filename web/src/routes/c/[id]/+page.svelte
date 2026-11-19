<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { CollectionError, COLLECTION_NAME_MAX, library, type Collection, type Video } from '#lib/db/index.ts';
	import { ALL, videosIn } from '#lib/db/scope.ts';
	import { shelfSummary } from '#lib/shelf.ts';
	import Icon from '#lib/ui/Icon.svelte';
	import ScreenCard from '#lib/ui/ScreenCard.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';

	const scope = $derived(page.params.id ?? ALL);
	const isAll = $derived(scope === ALL);

	let collection = $state<Collection | undefined>();
	let collections = $state<Collection[]>([]);
	let videos = $state<Video[] | null>(null);
	let missing = $state(false);

	let editing = $state(false);
	let renaming = $state(false);
	let renameValue = $state('');
	let confirmingDelete = $state(false);
	let moving = $state<Video | null>(null);
	let error = $state('');

	async function load() {
		const lib = await library();
		collections = await lib.listCollections();
		if (isAll) {
			collection = undefined;
			missing = false;
		} else {
			collection = collections.find((c) => c.id === scope);
			missing = !collection;
		}
		videos = missing ? [] : await videosIn(lib, scope);
	}

	$effect(() => {
		void scope;
		editing = renaming = confirmingDelete = false;
		moving = null;
		error = '';
		load();
	});

	const title = $derived(isAll ? 'Todos' : (collection?.name ?? ''));
	const count = $derived(videos ? shelfSummary(videos) : '');
	const currentOf = (v: Video) => collections.find((c) => c.order.includes(v.id));

	const messages: Record<string, string> = {
		empty_name: 'Dê um nome à coleção.',
		name_too_long: `Use até ${COLLECTION_NAME_MAX} caracteres.`,
		reserved_name: '"Todos" já existe. Escolha outro nome.'
	};
	const explain = (e: unknown) =>
		e instanceof CollectionError ? (messages[e.code] ?? 'Algo mudou. Atualize e tente de novo.') : 'Não deu para salvar agora.';

	function toggleEdit() {
		editing = !editing;
		renaming = confirmingDelete = false;
		error = '';
	}

	async function rename(event: SubmitEvent) {
		event.preventDefault();
		if (!collection) return;
		try {
			await (await library()).renameCollection(collection.id, renameValue);
			renaming = false;
			error = '';
			await load();
		} catch (e) {
			error = explain(e);
		}
	}

	async function remove() {
		if (!collection) return;
		try {
			await (await library()).deleteCollection(collection.id);
			await goto('/', { replaceState: true });
		} catch (e) {
			error = explain(e);
		}
	}

	let moveBusy = false;

	// The sheet stays open until the write is committed: closing first let a quick
	// navigation abort the IndexedDB transaction and lose the move.
	async function moveTo(target: string | null) {
		if (!moving || moveBusy) return;
		moveBusy = true;
		try {
			await (await library()).moveVideo(moving.id, target);
			error = '';
		} catch (e) {
			error = explain(e);
		} finally {
			moveBusy = false;
			moving = null;
		}
		await load();
	}
</script>

<main class="collection on-dark">
	<header>
		<a class="icon-button" href="/" aria-label="Voltar"><Icon name="back" /></a>
		{#if videos && !missing}
			<button class="text-button" type="button" onclick={toggleEdit} aria-pressed={editing}>
				{editing ? 'Concluído' : 'Editar'}
			</button>
		{/if}
	</header>

	{#if missing}
		<section class="state">
			<h1>Essa coleção não existe mais.</h1>
			<a class="pill" href="/">Voltar à biblioteca</a>
		</section>
	{:else if !videos}
		<section class="state" aria-busy="true" aria-label="Carregando"></section>
	{:else}
		<section class="head">
			<h1>{title}</h1>
			<p class="count">{count}</p>

			{#if editing && collection}
				{#if renaming}
					<form class="inline" onsubmit={rename} novalidate>
						<label class="label" for="rename">Novo nome</label>
						<input id="rename" type="text" bind:value={renameValue} autocomplete="off" />
						<div class="row-buttons">
							<button class="chip primary" type="submit">Salvar</button>
							<button class="chip" type="button" onclick={() => (renaming = false)}>Cancelar</button>
						</div>
					</form>
				{:else if confirmingDelete}
					<div class="inline" role="alertdialog" aria-label="Confirmar exclusão">
						<p>Excluir “{collection.name}”? Os vídeos continuam em Todos.</p>
						<div class="row-buttons">
							<button class="chip danger" type="button" onclick={remove}>Excluir coleção</button>
							<button class="chip" type="button" onclick={() => (confirmingDelete = false)}>Cancelar</button>
						</div>
					</div>
				{:else}
					<div class="row-buttons">
						<button
							class="chip"
							type="button"
							onclick={() => {
								renameValue = collection?.name ?? '';
								renaming = true;
								error = '';
							}}>Renomear</button
						>
						<button class="chip" type="button" onclick={() => (confirmingDelete = true)}>Excluir</button>
					</div>
				{/if}
			{/if}
			{#if error}<p class="error" role="alert">{error}</p>{/if}
		</section>

		{#if videos.length === 0}
			<section class="state">
				<h2>Nada aqui ainda.</h2>
				<p>
					{#if isAll}
						Cole um link para começar.
					{:else}
						Abra Todos, toque em Editar e mova vídeos para esta coleção.
					{/if}
				</p>
				<a class="pill" href={isAll ? '/add' : `/c/${ALL}`}>{isAll ? 'Colar um link' : 'Abrir Todos'}</a>
			</section>
		{:else}
			<ul class="videos" class:editing>
				{#each videos as v, i (v.id)}
					<li style={`z-index: ${i + 1}`}>
						<ScreenCard video={v} index={i} href={`/v/${v.id}?c=${scope}`} flat={editing} />
						{#if editing}
							<button class="chip" type="button" onclick={() => (moving = v)} aria-label={`Mover “${v.title}”`}>
								Mover
							</button>
						{/if}
					</li>
				{/each}
			</ul>

			{#if !editing}
				<footer>
					<a class="cta" href={`/v/${videos[0].id}?c=${scope}`}>
						<Icon name="play" size={18} />
						Assistir em sequência
					</a>
				</footer>
			{/if}
		{/if}
	{/if}
</main>

<Sheet open={moving !== null} title="Mover para" onclose={() => (moving = null)}>
	{#if moving}
		{@const here = currentOf(moving)}
		{#each collections as c (c.id)}
			<button class="option" type="button" disabled={here?.id === c.id} onclick={() => moveTo(c.id)}>
				{c.name}{here?.id === c.id ? ' · está aqui' : ''}
			</button>
		{/each}
		{#if here}
			<button class="option" type="button" onclick={() => moveTo(null)}>Tirar da coleção</button>
		{/if}
		{#if collections.length === 0}
			<p class="sheet-empty">Você ainda não tem coleções.</p>
			<a class="option" href="/c/new">Criar coleção</a>
		{/if}
	{/if}
</Sheet>

<style>
	.collection {
		min-height: 100svh;
		background: var(--color-bg-dark);
		color: var(--color-text-dark);
		padding: calc(var(--space-6) + env(safe-area-inset-top)) var(--screen-pad)
			calc(var(--space-9) + env(safe-area-inset-bottom));
		display: flex;
		flex-direction: column;
	}

	header,
	.head,
	.videos,
	.state,
	footer {
		width: 100%;
		max-width: var(--layout-content-max);
		margin-inline: auto;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.text-button {
		height: var(--layout-touch-min);
		padding: 0 var(--space-4);
		border: none;
		border-radius: var(--radius-pill);
		background: var(--color-surface-dark);
		color: var(--color-text-dark);
		font-weight: 600;
	}

	.head {
		padding: var(--space-4) 0 var(--space-6);
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: var(--space-3);
	}

	h1 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: var(--size-display);
		line-height: 1.02;
		letter-spacing: -0.02em;
		overflow-wrap: anywhere;
	}

	.count {
		color: var(--color-muted-on-dark);
		font-size: var(--size-meta);
	}

	.row-buttons {
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
		justify-content: center;
	}

	.chip {
		height: 40px;
		padding: 0 var(--space-4);
		border: none;
		border-radius: var(--radius-pill);
		background: var(--color-surface-dark);
		color: var(--color-text-dark);
		font-weight: 600;
		font-size: var(--size-meta);
	}

	.chip.primary {
		background: var(--color-text-dark);
		color: var(--color-bg-dark);
	}

	.chip.danger {
		background: var(--color-action-alert);
		color: var(--color-bg-dark);
	}

	.inline {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		align-self: stretch;
		text-align: left;
	}

	.inline p {
		line-height: 1.4;
	}

	.inline input {
		background: transparent;
		border: none;
		border-bottom: 2px solid #3a3a3a;
		padding: var(--space-3) 0;
		font-size: 20px;
		color: var(--color-text-dark);
		outline: none;
	}

	.inline input:focus-visible {
		border-bottom-color: var(--color-text-dark);
	}

	.error {
		color: var(--color-action-alert);
		font-size: var(--size-meta);
		font-weight: 600;
	}

	.state {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-4);
		padding-top: var(--space-9);
	}

	.state h1,
	.state h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: var(--size-title);
		line-height: 1.1;
	}

	.state p {
		color: var(--color-muted-on-dark);
		line-height: 1.45;
		max-width: 34ch;
	}

	.pill {
		display: inline-flex;
		align-items: center;
		height: 56px;
		padding: 0 var(--space-7);
		border-radius: var(--radius-pill);
		background: var(--color-text-dark);
		color: var(--color-bg-dark);
		font-weight: 600;
		text-decoration: none;
	}

	.videos {
		--overlap: clamp(24px, 6vw, 44px);
		list-style: none;
		padding: 0 var(--space-1);
		margin-block: 0;
		/* The screens' z-index and 3D lift stay inside the pile, below the sticky button. */
		isolation: isolate;
	}

	/* Each screen gets its own vanishing point, so every one is foreshortened the same
	   way however far down the pile it sits. */
	.videos li {
		position: relative;
		perspective: 900px;
		perspective-origin: 50% 30%;
	}

	.videos li + li {
		margin-top: calc(var(--overlap) * -1);
	}

	/* Editing lays the screens flat and apart so Mover is easy to hit. */
	.videos.editing {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.videos.editing li {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin-top: 0;
		perspective: none;
	}

	.videos.editing li :global(.screen) {
		flex: 1;
		min-width: 0;
	}

	footer {
		position: sticky;
		bottom: 0;
		z-index: 100;
		padding-top: var(--space-8);
		padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom));
		/* Rows fade out under the button instead of running into it. */
		background: linear-gradient(to top, var(--color-bg-dark) 62%, transparent);
	}

	.cta {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-3);
		height: 60px;
		border-radius: var(--radius-pill);
		background: var(--color-text-dark);
		color: var(--color-bg-dark);
		font-size: var(--size-body);
		font-weight: 600;
		text-decoration: none;
		transition: transform var(--motion-press);
	}

	.cta:active {
		transform: scale(0.97);
	}

	.option {
		display: block;
		width: 100%;
		text-align: left;
		min-height: 56px;
		padding: 0 var(--space-5);
		border: none;
		border-radius: var(--radius-pill);
		background: #232323;
		color: var(--color-text-dark);
		font-size: var(--size-body);
		font-weight: 600;
		text-decoration: none;
		display: flex;
		align-items: center;
	}

	.option:disabled {
		opacity: 0.5;
	}

	.sheet-empty {
		color: var(--color-muted-on-dark);
		padding: 0 var(--space-2);
	}
</style>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { CollectionError, COLLECTION_NAME_MAX, library, type Collection, type Video } from '#lib/db/index.ts';
	import { ALL, videosIn } from '#lib/db/scope.ts';
	import { markSource } from '#lib/transition.ts';
	import Icon from '#lib/ui/Icon.svelte';
	import PaperStack from '#lib/ui/PaperStack.svelte';
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
	const count = $derived(videos ? (videos.length === 1 ? '1 vídeo' : `${videos.length} vídeos`) : '');
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
			{#if videos.length > 0}<PaperStack items={videos} />{/if}
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
			<ul class="videos">
				{#each videos as v (v.id)}
					<li>
						<a class="row" href={`/v/${v.id}?c=${scope}`} onclick={(e) => markSource(e, '.thumb')}>
							<span class="thumb">
								{#if v.thumbnail}<img
										src={v.thumbnail}
										alt=""
										loading="lazy"
										referrerpolicy="no-referrer"
										onerror={(e) => ((e.currentTarget as HTMLElement).style.display = 'none')}
									/>{/if}
							</span>
							<span class="text">
								{#if v.author}<span class="author">{v.author}</span>{/if}
								<span class="name">{v.title}</span>
							</span>
						</a>
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
		padding: var(--space-8) 0 var(--space-5);
		display: flex;
		flex-direction: column;
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
		list-style: none;
		padding: 0;
		margin-block: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.videos li {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.row {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-2);
		border-radius: var(--radius-thumb);
		background: var(--color-surface-dark);
		color: inherit;
		text-decoration: none;
	}

	.thumb {
		flex: none;
		width: 56px;
		height: 72px;
		border-radius: var(--radius-paper);
		overflow: hidden;
		background: #2b2b2b;
	}

	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.text {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.author {
		font-size: var(--size-meta);
		color: var(--color-muted-on-dark);
	}

	.name {
		font-family: var(--font-display);
		font-size: 19px;
		line-height: 1.15;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	footer {
		position: sticky;
		bottom: calc(var(--space-4) + env(safe-area-inset-bottom));
		padding-top: var(--space-6);
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

<script lang="ts">
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { CollectionError, COLLECTION_NAME_MAX, library, type Collection, type Video } from '#lib/db/index.ts';
	import { ALL, FAVORITES, WATCHED, isVirtual, videosIn } from '#lib/db/scope.ts';
	import { shelfSummary } from '#lib/shelf.ts';
	import BackToTop from '#lib/ui/BackToTop.svelte';
	import DangerScreen from '#lib/ui/DangerScreen.svelte';
	import EditVideoSheet from '#lib/ui/EditVideoSheet.svelte';
	import Icon from '#lib/ui/Icon.svelte';
	import Illustration from '#lib/ui/Illustration.svelte';
	import ScreenCard from '#lib/ui/ScreenCard.svelte';
	import { canUseWebGL3D, readEnv } from '#lib/capability.ts';
	import MoveSheet from '#lib/ui/MoveSheet.svelte';

	const scope = $derived(page.params.id ?? ALL);
	const isAll = $derived(scope === ALL);
	const virtual = $derived(isVirtual(scope));

	let collection = $state<Collection | undefined>();
	let collections = $state<Collection[]>([]);
	let videos = $state<Video[] | null>(null);
	let missing = $state(false);

	let editing = $state(false);
	let renaming = $state(false);
	let renameValue = $state('');
	let confirmingDelete = $state(false);
	let moving = $state<Video | null>(null);
	let editingVideo = $state<Video | null>(null);
	let removingVideo = $state<Video | null>(null);
	let dangerBusy = $state(false);
	let titleInput = $state<HTMLInputElement>();
	let error = $state('');

	async function load() {
		const lib = await library();
		collections = await lib.listCollections();
		if (virtual) {
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

	const title = $derived(
		scope === ALL ? 'Todos' : scope === FAVORITES ? 'Favoritos' : scope === WATCHED ? 'Assistidos' : (collection?.name ?? '')
	);
	// WebGL monitors (slice 2e-3): one fixed canvas, loaded only when the device can run it
	// and the pile is not being edited. Anything else keeps the CSS-3D monitors.
	let list = $state<HTMLElement | null>(null);
	let Layer = $state<(typeof import('#lib/ui/MonitorLayer.svelte'))['default'] | null>(null);
	let glReady = $state(false);
	let glFailed = $state(false);
	let glOff = $state(new Set<string>());
	const wantGl = $derived(!editing && !glFailed && !!videos?.length);

	$effect(() => {
		if (!wantGl || Layer || !list || typeof window === 'undefined') return;
		if (!canUseWebGL3D(readEnv())) return;
		const load = () =>
			import('#lib/ui/MonitorLayer.svelte')
				.then((m) => (Layer = m.default))
				.catch(() => (glFailed = true));
		if ('requestIdleCallback' in window) {
			const h = requestIdleCallback(load, { timeout: 1500 });
			return () => cancelIdleCallback(h);
		}
		const t = setTimeout(load, 200);
		return () => clearTimeout(t);
	});

	$effect(() => {
		if (!wantGl) glReady = false;
	});

	const count = $derived(videos ? shelfSummary(videos) : '');

	const messages: Record<string, string> = {
		empty_name: 'Dê um nome à coleção.',
		name_too_long: `Use até ${COLLECTION_NAME_MAX} caracteres.`,
		reserved_name: 'Esse nome é reservado (Todos, Favoritos, Assistidos). Escolha outro.'
	};
	const explain = (e: unknown) =>
		e instanceof CollectionError ? (messages[e.code] ?? 'Algo mudou. Atualize e tente de novo.') : 'Não deu para salvar agora.';

	function toggleEdit() {
		editing = !editing;
		renaming = confirmingDelete = false;
		error = '';
	}

	// The title itself becomes the field: no second input underneath.
	async function startRename() {
		if (!collection) return;
		renameValue = collection.name;
		renaming = true;
		error = '';
		await tick();
		titleInput?.focus();
		titleInput?.select();
	}

	async function commitRename() {
		if (!renaming || !collection) return;
		const next = renameValue;
		if (next.trim() === collection.name) {
			renaming = false;
			return;
		}
		try {
			await (await library()).renameCollection(collection.id, next);
			renaming = false;
			error = '';
			await load();
		} catch (e) {
			error = explain(e);
			titleInput?.focus();
		}
	}

	function cancelRename() {
		renaming = false;
		error = '';
	}

	async function removeVideo() {
		if (!removingVideo || dangerBusy) return;
		dangerBusy = true;
		try {
			await (await library()).deleteVideo(removingVideo.id);
			removingVideo = null;
			await load();
		} catch {
			error = 'Não deu para apagar agora. Tente de novo.';
		} finally {
			dangerBusy = false;
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
			{#if renaming}
				<form
					class="rename"
					onsubmit={(e) => {
						e.preventDefault();
						commitRename();
					}}
				>
					<input
						class="title-edit"
						aria-label="Novo nome da coleção"
						type="text"
						bind:this={titleInput}
						bind:value={renameValue}
						autocomplete="off"
						enterkeyhint="done"
						onblur={commitRename}
						onkeydown={(e) => e.key === 'Escape' && cancelRename()}
					/>
				</form>
			{:else}
				<h1>{title}</h1>
			{/if}
			<p class="count">{count}</p>

			{#if editing && collection}
				<div class="row-buttons">
					<button class="chip" type="button" onmousedown={(e) => e.preventDefault()} onclick={startRename}>Renomear</button>
					<button class="chip" type="button" onclick={() => (confirmingDelete = true)}>Excluir</button>
				</div>
			{/if}
			{#if error}<p class="error" role="alert">{error}</p>{/if}
		</section>

		{#if videos.length === 0}
			<section class="state">
				<Illustration kind="collection" />
				<h2>Nada aqui ainda.</h2>
				<p>
					{#if isAll}
						Cole um link para começar.
					{:else if scope === FAVORITES}
						Toque no coração de um vídeo e ele aparece aqui.
					{:else if scope === WATCHED}
						Marque um vídeo como assistido, ou deixe um arquivo terminar, e ele aparece aqui.
					{:else}
						Abra Todos, toque em Editar e mova vídeos para esta coleção.
					{/if}
				</p>
				<div class="actions">
					<a class="pill" href={isAll ? '/add' : `/c/${ALL}`}>{isAll ? 'Colar um link' : 'Abrir Todos'}</a>
					{#if isAll}<a class="pill ghost" href="/c/new">Nova coleção</a>{/if}
				</div>
			</section>
		{:else}
			{#if Layer && wantGl && list}
				<Layer
					{list}
					heart={scope === FAVORITES}
					onready={() => (glReady = true)}
					onfail={() => (glFailed = true)}
					onrowfail={(id) => (glOff = new Set(glOff).add(id))}
				/>
			{/if}
			<ul class="videos" class:editing class:gl={glReady && wantGl} bind:this={list}>
				{#each videos as v, i (v.id)}
					<li style={`z-index: ${i + 1}`} data-id={v.id} class:gl-off={glOff.has(v.id)}>
						<ScreenCard video={v} index={i} href={`/v/${v.id}?c=${scope}`} flat={editing} heart={scope === FAVORITES} />
						{#if editing}
							<div class="row-buttons">
								<button class="chip" type="button" onclick={() => (editingVideo = v)} aria-label={`Editar “${v.title}”`}>Editar</button>
								<button class="chip" type="button" onclick={() => (moving = v)} aria-label={`Mover “${v.title}”`}>Mover</button>
								<button class="chip" type="button" onclick={() => (removingVideo = v)} aria-label={`Apagar “${v.title}”`}>Apagar</button>
							</div>
						{/if}
					</li>
				{/each}
			</ul>

			{#if !editing}
				<footer>
					<a class="cta" href={`/v/${videos[0].id}?c=${scope}`}>
						<span class="icon"><Icon name="play" size={16} /></span>
						Assistir em sequência
					</a>
				</footer>
			{/if}
		{/if}
	{/if}
</main>

<BackToTop onDark lift={editing || !videos?.length ? 0 : 96} />

{#if confirmingDelete && collection}
	<DangerScreen
		title={`Excluir “${collection.name}”?`}
		body="Os vídeos continuam em Todos. Só a coleção e a ordem dela somem."
		confirmLabel="Excluir coleção"
		onconfirm={remove}
		oncancel={() => (confirmingDelete = false)}
	/>
{/if}

{#if removingVideo}
	<DangerScreen
		title="Apagar este vídeo?"
		body="Ele sai da sua biblioteca e das coleções. O link original não é afetado."
		confirmLabel="Apagar vídeo"
		thumb={removingVideo.thumbnail}
		busy={dangerBusy}
		{error}
		onconfirm={removeVideo}
		oncancel={() => (removingVideo = null)}
	/>
{/if}

<EditVideoSheet video={editingVideo} onclose={() => (editingVideo = null)} onsaved={() => load()} />

<MoveSheet video={moving} onclose={() => (moving = null)} onmoved={() => load()} />

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

	/* The title turns into its own field: same type, same place, no second input. */
	.rename {
		width: 100%;
	}

	.title-edit {
		width: 100%;
		border: none;
		border-bottom: 2px solid var(--color-surface-dark-raised);
		background: transparent;
		color: var(--color-text-dark);
		font-family: var(--font-display);
		font-weight: 400;
		font-size: var(--size-display);
		line-height: 1.02;
		letter-spacing: -0.02em;
		text-align: center;
		outline: none;
		padding: 0 0 var(--space-1);
	}

	.title-edit:focus-visible {
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

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}

	.pill.ghost {
		background: var(--color-surface-dark-raised);
		color: var(--color-text-dark);
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

	/* WebGL monitors drawn: the rows keep their box, link and text for touch, focus and
	   screen readers, but paint nothing (the canvas behind draws them). A row whose cover
	   cannot be used in WebGL (no CORS) stays a CSS monitor. */
	.videos.gl li:not(.gl-off) :global(.screen) {
		background: transparent;
		box-shadow: none;
		transform: none;
		transition: none;
	}

	.videos.gl li:not(.gl-off) :global(.screen > *) {
		opacity: 0;
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

	/* The options sit under their card, so the card keeps the full width. */
	.videos.editing li {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: var(--space-2);
		margin-top: 0;
		perspective: none;
	}

	.videos.editing li :global(.screen) {
		min-width: 0;
	}

	.videos.editing .row-buttons .chip {
		flex: 1 1 0;
		min-width: 0;
		padding-inline: var(--space-2);
	}

	footer {
		position: sticky;
		bottom: 0;
		z-index: 100;
		padding-top: var(--space-6);
		/* Room for the shadow below the button: Safari cuts the page at its toolbar. */
		padding-bottom: calc(var(--space-6) + env(safe-area-inset-bottom));
		/* No band or gradient: the button floats, and its own shadow keeps it readable. */
		background: none;
		pointer-events: none;
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
		pointer-events: auto;
		box-shadow:
			0 1px 3px rgb(0 0 0 / 0.4),
			0 4px 14px rgb(0 0 0 / 0.45);
		transition: transform var(--motion-press);
	}

	.cta .icon {
		display: inline-grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: var(--color-bg-dark);
		color: var(--color-text-dark);
	}

	.cta:active {
		transform: scale(0.97);
	}

</style>

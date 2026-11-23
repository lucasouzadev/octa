<script lang="ts">
	import { library, type Collection, type Video } from '#lib/db/index.ts';
	import { ALL, FAVORITES, WATCHED } from '#lib/db/scope.ts';
	import { enrichPending } from '#lib/enrich.ts';
	import { upgradeGenericTitles } from '#lib/links.ts';
	import { sweepHealth } from '#lib/health.ts';
	import { searchVideos } from '#lib/search.ts';
	import { markSource } from '#lib/transition.ts';
	import BackToTop from '#lib/ui/BackToTop.svelte';
	import CreateMenu from '#lib/ui/CreateMenu.svelte';
	import FanStack from '#lib/ui/FanStack.svelte';
	import Icon from '#lib/ui/Icon.svelte';
	import OrganizeSheet from '#lib/ui/OrganizeSheet.svelte';
	import {
		arrange,
		loadDefaultSlots,
		loadMode,
		moveBy,
		moveTo,
		saveDefaultSlots,
		saveMode,
		slotAt,
		type DefaultSlots,
		type Ranked,
		type SortMode
	} from '#lib/organize.ts';
	import { BACKUP_ERROR_TEXT, exportLibrary, importLibrary, importMessage } from '#lib/backup-io.ts';
	import { toast } from '#lib/toast.svelte.ts';
	import Illustration from '#lib/ui/Illustration.svelte';

	let videos = $state<Video[] | null>(null);
	let collections = $state<Collection[] | null>(null);
	let mode = $state<SortMode>('manual');

	async function reload() {
		const lib = await library();
		[videos, collections] = await Promise.all([lib.list(), lib.listCollections()]);
	}

	async function doExport() {
		organizeOpen = false;
		try {
			await exportLibrary();
		} catch {
			toast.show('Não deu para exportar');
		}
	}

	async function doImport(file: File) {
		organizeOpen = false;
		try {
			const r = await importLibrary(file);
			if (!r.ok) return toast.show(BACKUP_ERROR_TEXT[r.error]);
			await reload();
			toast.show(importMessage(r.summary, r.dropped));
		} catch {
			toast.show('Não deu para importar');
		}
	}

	$effect(() => {
		library().then(async (lib) => {
			mode = loadMode();
			slots = loadDefaultSlots();
			[videos, collections] = await Promise.all([lib.list(), lib.listCollections()]);
			// TikToks saved with the generic title get their @handle title (edited titles stay).
			if (await upgradeGenericTitles(lib)) videos = await lib.list();
			// Videos saved while the API was asleep get their real title now.
			if (await enrichPending(lib)) videos = await lib.list();
			// Links not checked in the last 24 h are checked now (SPEC §5).
			if (await sweepHealth(lib)) videos = await lib.list();
		});
	});

	const DEFAULT_KEYS = [ALL, FAVORITES, WATCHED];

	interface Card {
		key: string;
		href: string;
		name: string;
		items: Video[];
	}

	let slots = $state<DefaultSlots>({});

	// Todos, Favoritos, Assistidos and the person's collections share one order (R6.1): by hand, the
	// defaults sit where the person put them; any other sort treats them like collections.
	const cards = $derived.by<Card[] | null>(() => {
		if (!videos || !collections) return null;
		const byVideo = new Map(videos.map((v) => [v.id, v]));
		const entry = (key: string, name: string, items: Video[], rank?: number): Ranked & Card => ({
			id: key,
			key,
			href: `/c/${key}`,
			name,
			items,
			order: items.map((v) => v.id),
			createdAt: '',
			updatedAt: items.reduce((m, v) => (v.createdAt > m ? v.createdAt : m), ''),
			rank
		});
		const defaults = [
			...(videos.length > 0 ? [entry(ALL, 'Todos', videos)] : []),
			// Marks the person makes, shown only once there is something in them.
			...[
				entry(FAVORITES, 'Favoritos', videos.filter((v) => v.favorite)),
				entry(WATCHED, 'Assistidos', videos.filter((v) => v.watched))
			].filter((c) => c.items.length > 0)
		];
		const own = collections.map((c) => ({
			...entry(
				c.id,
				c.name,
				c.order.map((id) => byVideo.get(id)).filter((v): v is Video => v !== undefined),
				c.rank
			),
			createdAt: c.createdAt,
			updatedAt: c.updatedAt,
			order: c.order
		}));
		return arrange(own, defaults, mode, slots);
	});

	const count = (n: number) => (n === 1 ? '1 vídeo' : `${n} vídeos`);
	// "3 coleções · 52 vídeos" (prototype page 2); "Todos" is virtual, so it is not counted.
	const summary = $derived.by(() => {
		if (!videos || !collections) return '';
		const n = collections.length;
		return n === 0 ? count(videos.length) : `${n === 1 ? '1 coleção' : `${n} coleções`} · ${count(videos.length)}`;
	});

	// Search runs over the whole library, not just one collection.
	let searching = $state(false);
	let query = $state('');
	let input = $state<HTMLInputElement>();
	const typed = $derived(query.trim().length > 0);
	const results = $derived(videos && typed ? searchVideos(videos, query) : []);

	function openSearch() {
		searching = true;
		// The input only exists once the header re-renders.
		queueMicrotask(() => input?.focus());
	}

	function closeSearch() {
		searching = false;
		query = '';
	}

	// --- Organizar / Reordenar -------------------------------------------------------------
	let organizeOpen = $state(false);
	let reordering = $state(false);
	/** Keys of every card while reordering (the saved order is written on each move). */
	let draft = $state<string[]>([]);
	let live = $state('');
	let listEl = $state<HTMLElement>();

	interface Drag {
		id: string;
		from: number;
		to: number;
		/** Pointer distance from the row's top edge, in page pixels. */
		grab: number;
		tops: number[];
		height: number;
		dy: number;
	}
	let drag = $state<Drag | null>(null);
	let pointerY = 0;
	let frame = 0;

	/**
	 * The rows keep their DOM order for the whole drag: moving the node under the finger ends the touch
	 * on iOS. The others slide aside with a transform and the real order is written when the finger lifts.
	 */
	function shift(i: number, d: Drag): number {
		if (i === d.from) return d.dy;
		if (d.from < d.to && i > d.from && i <= d.to) return d.tops[i - 1] - d.tops[i];
		if (d.from > d.to && i >= d.to && i < d.from) return d.tops[i + 1] - d.tops[i];
		return 0;
	}
	const byKey = $derived(new Map((cards ?? []).map((c) => [c.key, c])));

	function chooseMode(next: SortMode) {
		mode = next;
		saveMode(next);
	}

	function startReorder() {
		organizeOpen = false;
		draft = (cards ?? []).map((c) => c.key);
		reordering = true;
		closeSearch();
		scrollTo({ top: 0 });
	}

	async function save(ids: string[]) {
		draft = ids;
		// What the screen shows is the saved order: switch to "Minha ordem" with it.
		const own = ids.filter((id) => collections?.some((c) => c.id === id));
		collections = (collections ?? []).map((c) => ({ ...c, rank: own.indexOf(c.id) }));
		slots = Object.fromEntries(ids.flatMap((id, i) => (DEFAULT_KEYS.includes(id) ? [[id, i]] : [])));
		saveDefaultSlots(slots);
		chooseMode('manual');
		try {
			await (await library()).setCollectionRanks(own);
		} catch {
			toast.show('Não deu para salvar a ordem');
		}
	}

	function announce(id: string, ids: string[]) {
		live = `${byKey.get(id)?.name ?? ''}: posição ${ids.indexOf(id) + 1} de ${ids.length}`;
	}

	function handleKey(e: KeyboardEvent, id: string) {
		if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
		e.preventDefault();
		const next = moveBy(draft, id, e.key === 'ArrowUp' ? -1 : 1);
		if (next.join() === draft.join()) return;
		save(next);
		announce(id, next);
	}

	function place() {
		if (!drag) return;
		const page = pointerY + scrollY;
		const center = page - drag.grab + drag.height / 2;
		const to = slotAt(center, drag.tops, drag.height);
		drag = { ...drag, to, dy: page - drag.grab - drag.tops[drag.from] };
	}

	// While the finger is near an edge the page keeps scrolling under it.
	function follow() {
		if (!drag) return;
		const edge = 88;
		if (pointerY < edge) scrollBy(0, -Math.ceil((edge - pointerY) / 6));
		else if (pointerY > innerHeight - edge) scrollBy(0, Math.ceil((pointerY - (innerHeight - edge)) / 6));
		place();
		frame = requestAnimationFrame(follow);
	}

	function startDrag(e: PointerEvent, id: string) {
		if (drag || !listEl || (e.pointerType === 'mouse' && e.button !== 0)) return;
		const items = [...listEl.querySelectorAll<HTMLElement>('li[data-mine]')];
		const from = items.findIndex((el) => el.dataset.mine === id);
		if (from < 0) return;
		const rects = items.map((el) => el.getBoundingClientRect());
		const tops = rects.map((r) => r.top + scrollY);
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		pointerY = e.clientY;
		drag = { id, from, to: from, grab: e.clientY + scrollY - tops[from], tops, height: rects[from].height, dy: 0 };
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(follow);
	}

	function moveDrag(e: PointerEvent) {
		if (!drag) return;
		pointerY = e.clientY;
		place();
	}

	function endDrag() {
		if (!drag) return;
		cancelAnimationFrame(frame);
		const { id, from, to } = drag;
		drag = null;
		if (from === to) return;
		const next = moveTo(draft, from, to);
		save(next);
		announce(id, next);
	}

	function finishReorder() {
		reordering = false;
		toast.show('Ordem salva');
	}

	function onkeydown(e: KeyboardEvent) {
		if (searching && e.key === 'Escape') closeSearch();
		if (reordering && !drag && e.key === 'Escape') finishReorder();
	}
</script>

<svelte:window {onkeydown} />

<main class="library">
	{#if reordering}
		<header class="reorderbar">
			<div class="heading">
				<h1>Reordenar</h1>
				<p>Arraste pela alça, ou use as setas.</p>
			</div>
			<button class="text-button" type="button" onclick={finishReorder}>Concluir</button>
		</header>
	{:else if searching}
		<header class="searchbar">
			<form role="search" onsubmit={(e) => e.preventDefault()}>
				<span class="glass"><Icon name="search" size={20} /></span>
				<input
					bind:this={input}
					bind:value={query}
					type="search"
					enterkeyhint="search"
					autocomplete="off"
					autocapitalize="off"
					spellcheck="false"
					placeholder="Buscar por título ou autor"
					aria-label="Buscar vídeos"
				/>
			</form>
			<button class="text-button" type="button" onclick={closeSearch}>Cancelar</button>
		</header>
	{:else}
		<header>
			<div class="side">
			<button
				class="icon-button"
				type="button"
				onclick={openSearch}
				aria-label="Buscar vídeos"
				disabled={!videos || videos.length === 0}
			>
				<Icon name="search" />
			</button>
			</div>
			<div class="heading">
				<h1>Minha coleção</h1>
				{#if videos}<p>{summary}</p>{/if}
			</div>
			<div class="side end">
				{#if videos}
					<button class="icon-button" type="button" onclick={() => (organizeOpen = true)} aria-label="Organizar">
						<Icon name="sort" />
					</button>
					{#if videos.length > 0}<CreateMenu />{/if}
				{:else}
					<span class="spacer" aria-hidden="true"></span>
				{/if}
			</div>
		</header>
	{/if}

	{#if reordering}
		<ul class="reorder" bind:this={listEl} aria-label="Coleções">
			{#each draft as id, i (id)}
				{@const c = byKey.get(id)}
				{#if c}
					<li
						class="rrow"
						class:lifted={drag?.id === id}
						data-mine={id}
						class:slide={drag && drag.id !== id}
						style:transform={drag ? `translateY(${shift(i, drag)}px)` : undefined}
					>
						<span class="rname">{c.name}</span>
						<span class="rcount">{count(c.items.length)}</span>
						<button
							class="handle"
							type="button"
							aria-label={`Mover ${c.name}`}
							onpointerdown={(e) => startDrag(e, id)}
							onpointermove={moveDrag}
							onpointerup={endDrag}
							onpointercancel={endDrag}
							onkeydown={(e) => handleKey(e, id)}
						>
							<Icon name="grip" />
						</button>
					</li>
				{/if}
			{/each}
		</ul>
		<p class="sr-only" role="status" aria-live="polite">{live}</p>
	{:else if searching && typed}
		<p class="status" role="status">
			{results.length === 0
				? 'Nenhum vídeo encontrado.'
				: results.length === 1
					? '1 resultado'
					: `${results.length} resultados`}
		</p>
		{#if results.length === 0}
			<section class="empty small">
				<Illustration kind="search" size={132} />
				<h2>Nada com “{query.trim()}”.</h2>
				<p>Tente outra palavra, o nome do autor ou menos letras.</p>
			</section>
		{:else}
			<ul class="results" aria-label="Resultados da busca">
				{#each results as v (v.id)}
					<li>
						<a class="row" href={`/v/${v.id}?c=${ALL}`} onclick={(e) => markSource(e, '.thumb')}>
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
					</li>
				{/each}
			</ul>
		{/if}
	{:else if !cards}
		<ul class="list" aria-busy="true" aria-label="Carregando coleções">
			{#each [0, 1] as n (n)}
				<li class="card skeleton" aria-hidden="true">
					<div class="thumbs"><span></span><span></span><span></span></div>
					<div class="line wide"></div>
					<div class="line short"></div>
				</li>
			{/each}
		</ul>
	{:else if videos && videos.length === 0}
		{#if cards.length > 0}
			<!-- Collections exist but no video yet: the collections lead, the way to the first video follows. -->
			<ul class="list" aria-label="Coleções">
				{#each cards as c (c.key)}
					<li>
						<a class="card bare" href={c.href} data-collection={c.key}>
							<h2 class="title">{c.name}</h2>
							<p class="count">{count(c.items.length)}</p>
						</a>
					</li>
				{/each}
			</ul>
			<div class="actions after-list">
				<a class="pill" href="/add"><Icon name="link" size={20} /> Colar um link</a>
				<a class="pill ghost" href="/c/new"><Icon name="folder-plus" size={20} /> Nova coleção</a>
			</div>
		{:else}
			<section class="empty">
				<Illustration kind="library" />
				<h2>Nada aqui ainda.</h2>
				<p>Cole o link de um vídeo do YouTube, de um Shorts ou de um arquivo .mp4.</p>
				<div class="actions">
					<a class="pill" href="/add"><Icon name="link" size={20} /> Colar um link</a>
					<a class="pill ghost" href="/c/new"><Icon name="folder-plus" size={20} /> Nova coleção</a>
				</div>
			</section>
		{/if}
	{:else}
		<ul class="list">
			{#each cards as c, i (c.key)}
				<li>
					<a class="card" class:bare={c.items.length === 0} href={c.href} data-collection={c.key}>
						<h2 class="title">{c.name}</h2>
						{#if c.items.length > 0}<FanStack items={c.items} id={c.key} order={i} />{/if}
						<p class="count">{count(c.items.length)}</p>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</main>

<OrganizeSheet
	open={organizeOpen}
	{mode}
	canOrder={(cards?.length ?? 0) >= 2}
	onmode={chooseMode}
	onreorder={startReorder}
	onexport={doExport}
	onimport={doImport}
	onclose={() => (organizeOpen = false)}
/>

<BackToTop />

<style>
	.library {
		min-height: 100svh;
		background: var(--color-bg-light);
		color: var(--color-text-light);
		padding: calc(var(--space-3) + env(safe-area-inset-top)) var(--space-4) var(--space-10);
	}

	header,
	.list,
	.results,
	.status,
	.empty,
	.after-list {
		max-width: var(--layout-content-max);
		margin-inline: auto;
	}

	header {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		padding: 0 var(--space-1) var(--space-6);
	}

	header.reorderbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	header.reorderbar .heading {
		text-align: left;
	}

	.reorder {
		list-style: none;
		padding: 0;
		margin-block: 0;
		max-width: var(--layout-content-max);
		margin-inline: auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		user-select: none;
		-webkit-user-select: none;
	}

	.rrow {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: 64px;
		padding: 0 var(--space-2) 0 var(--space-5);
		border-radius: var(--radius-pill);
		background: var(--color-surface-light);
	}


	/* Only while dragging: on drop the order and the transforms change together, nothing may animate. */
	.rrow.slide {
		transition: transform 160ms ease;
	}

	@media (prefers-reduced-motion: reduce) {
		.rrow.slide {
			transition: none;
		}
	}

	.rrow.lifted {
		position: relative;
		z-index: 2;
		box-shadow: 0 10px 24px rgb(0 0 0 / 0.22);
		background: var(--color-bg-light);
		outline: 2px solid var(--color-text-light);
	}

	.rname {
		flex: 1;
		min-width: 0;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.rcount {
		flex: none;
		font-size: var(--size-meta);
		color: var(--color-muted-on-light);
	}

	.handle {
		flex: none;
		width: var(--layout-touch-min);
		height: var(--layout-touch-min);
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 50%;
		background: none;
		color: inherit;
		touch-action: none; /* the drag must not scroll the page */
		cursor: grab;
	}

	.handle:focus-visible {
		outline: 2px solid var(--color-text-light);
	}

	header.searchbar {
		display: flex;
		gap: var(--space-3);
	}

	.searchbar form {
		flex: 1;
		min-width: 0;
		position: relative;
	}

	.glass {
		position: absolute;
		inset-block: 0;
		inset-inline-start: var(--space-4);
		display: flex;
		align-items: center;
		color: var(--color-muted-on-light);
		pointer-events: none;
	}

	.searchbar input {
		width: 100%;
		height: var(--layout-touch-min);
		padding-inline: calc(var(--space-4) + 28px) var(--space-4);
		border: 0;
		border-radius: var(--radius-pill);
		background: var(--color-surface-light);
		color: inherit;
		font: inherit;
		font-size: 16px; /* 16px stops iOS Safari from zooming on focus */
	}

	.searchbar input:focus-visible {
		outline: 2px solid var(--color-text-light);
		outline-offset: 2px;
	}

	.text-button {
		flex: none;
		min-height: var(--layout-touch-min);
		padding-inline: var(--space-2);
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		font-weight: 600;
	}

	.status {
		font-size: var(--size-meta);
		color: var(--color-muted-on-light);
		padding: 0 var(--space-1) var(--space-3);
	}

	.empty.small {
		padding-top: var(--space-6);
	}

	.empty.small h2 {
		font-size: var(--size-h2);
		line-height: 1.12;
	}

	.results {
		list-style: none;
		padding: 0;
		margin-block: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.row {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-2);
		border-radius: var(--radius-thumb);
		background: var(--color-surface-light);
		color: inherit;
		text-decoration: none;
	}

	.thumb {
		flex: none;
		width: 56px;
		height: 72px;
		border-radius: var(--radius-paper);
		overflow: hidden;
		background: #dcdcdc;
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
		color: var(--color-muted-on-light);
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

	.side {
		display: flex;
		gap: var(--space-2);
	}

	.side.end {
		justify-content: flex-end;
	}

	.heading {
		text-align: center;
	}

	.heading h1 {
		font-size: var(--size-body);
		font-weight: 600;
	}

	.heading p {
		font-size: var(--size-meta);
		color: var(--color-muted-on-light);
		margin-top: 2px;
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-5);
		padding: var(--space-11) var(--space-3) 0;
	}

	.empty h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: var(--size-display);
		line-height: 1.02;
		letter-spacing: -0.02em;
	}

	.empty p {
		color: var(--color-muted-on-light);
		line-height: 1.5;
		max-width: 32ch;
	}

	.pill {
		display: inline-flex;
		align-items: center;
		height: 56px;
		padding: 0 var(--space-7);
		border-radius: var(--radius-pill);
		background: var(--color-text-light);
		color: var(--color-text-dark);
		font-weight: 600;
		text-decoration: none;
	}

	.list {
		list-style: none;
		padding: 0;
		margin-block: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.card {
		display: block;
		padding: var(--space-5) var(--space-4) var(--space-5);
		border-radius: var(--radius-card);
		background: var(--color-surface-light);
		color: inherit;
		text-decoration: none;
		container-type: inline-size;
	}

	.thumbs {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-2);
	}

	.thumbs span {
		aspect-ratio: 3 / 4;
		border-radius: var(--radius-thumb);
		overflow: hidden;
		background: #dcdcdc;
	}

	.title {
		display: block;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: var(--size-h2);
		line-height: 1.12;
		letter-spacing: -0.01em;
		text-align: center;
		padding: var(--space-2) var(--space-1) var(--space-3);
	}

	.count {
		font-size: var(--size-meta);
		color: var(--color-muted-on-light);
		text-align: center;
		padding: var(--space-3) var(--space-1) 0;
	}

	.card.bare {
		padding-block: var(--space-4);
	}

	.card.bare .title {
		padding-bottom: var(--space-1);
	}

	.card.bare .count {
		padding-top: 0;
	}

	.after-list {
		margin-top: var(--space-5);
		padding-inline: var(--space-1);
	}

	.spacer {
		width: var(--layout-touch-min);
		height: var(--layout-touch-min);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}

	.pill {
		gap: var(--space-2);
	}

	.pill.ghost {
		background: var(--color-surface-light-button);
		color: var(--color-text-light);
	}

	.skeleton .line {
		height: 18px;
		border-radius: 9px;
		background: #e4e4e4;
		margin: var(--space-4) var(--space-1) 0;
	}

	.skeleton .line.wide {
		width: 55%;
		height: 26px;
	}

	.skeleton .line.short {
		width: 25%;
		height: 14px;
		margin-top: var(--space-2);
	}

	.skeleton .thumbs span {
		background: #e4e4e4;
	}

	@container (min-width: 560px) {
		.title {
			font-size: var(--size-title);
		}
	}
</style>

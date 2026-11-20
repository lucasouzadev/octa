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
	import Illustration from '#lib/ui/Illustration.svelte';

	let videos = $state<Video[] | null>(null);
	let collections = $state<Collection[] | null>(null);

	$effect(() => {
		library().then(async (lib) => {
			[videos, collections] = await Promise.all([lib.list(), lib.listCollections()]);
			// TikToks saved with the generic title get their @handle title (edited titles stay).
			if (await upgradeGenericTitles(lib)) videos = await lib.list();
			// Videos saved while the API was asleep get their real title now.
			if (await enrichPending(lib)) videos = await lib.list();
			// Links not checked in the last 24 h are checked now (SPEC §5).
			if (await sweepHealth(lib)) videos = await lib.list();
		});
	});

	interface Card {
		key: string;
		href: string;
		name: string;
		items: Video[];
	}

	// "Todos" is virtual and always first; user collections follow, oldest first.
	const cards = $derived.by<Card[] | null>(() => {
		if (!videos || !collections) return null;
		const byId = new Map(videos.map((v) => [v.id, v]));
		return [
			...(videos.length > 0 ? [{ key: ALL, href: `/c/${ALL}`, name: 'Todos', items: videos }] : []),
			// Marks the person makes, shown only once there is something in them.
			...[
				{ key: FAVORITES, name: 'Favoritos', items: videos.filter((v) => v.favorite) },
				{ key: WATCHED, name: 'Assistidos', items: videos.filter((v) => v.watched) }
			]
				.filter((c) => c.items.length > 0)
				.map((c) => ({ ...c, href: `/c/${c.key}` })),
			...collections.map((c) => ({
				key: c.id,
				href: `/c/${c.id}`,
				name: c.name,
				items: c.order.map((id) => byId.get(id)).filter((v): v is Video => v !== undefined)
			}))
		];
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

	function onkeydown(e: KeyboardEvent) {
		if (searching && e.key === 'Escape') closeSearch();
	}
</script>

<svelte:window {onkeydown} />

<main class="library">
	{#if searching}
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
			<button
				class="icon-button"
				type="button"
				onclick={openSearch}
				aria-label="Buscar vídeos"
				disabled={!videos || videos.length === 0}
			>
				<Icon name="search" />
			</button>
			<div class="heading">
				<h1>Minha coleção</h1>
				{#if videos}<p>{summary}</p>{/if}
			</div>
			{#if videos && videos.length > 0}
				<CreateMenu />
			{:else}
				<span class="spacer" aria-hidden="true"></span>
			{/if}
		</header>
	{/if}

	{#if searching && typed}
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
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 var(--space-1) var(--space-6);
	}

	header.searchbar {
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

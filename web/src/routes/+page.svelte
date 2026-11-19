<script lang="ts">
	import { library, type Collection, type Video } from '#lib/db/index.ts';
	import { ALL } from '#lib/db/scope.ts';
	import Icon from '#lib/ui/Icon.svelte';

	let videos = $state<Video[] | null>(null);
	let collections = $state<Collection[] | null>(null);

	$effect(() => {
		library().then(async (lib) => {
			[videos, collections] = await Promise.all([lib.list(), lib.listCollections()]);
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
			{ key: ALL, href: `/c/${ALL}`, name: 'Todos', items: videos },
			...collections.map((c) => ({
				key: c.id,
				href: `/c/${c.id}`,
				name: c.name,
				items: c.order.map((id) => byId.get(id)).filter((v): v is Video => v !== undefined)
			}))
		];
	});

	const count = (n: number) => (n === 1 ? '1 vídeo' : `${n} vídeos`);
</script>

<main class="library">
	<header>
		<span class="spacer" aria-hidden="true"></span>
		<div class="heading">
			<h1>Minha coleção</h1>
			{#if videos}<p>{count(videos.length)}</p>{/if}
		</div>
		<a class="icon-button" href="/add" aria-label="Adicionar link"><Icon name="plus" /></a>
	</header>

	{#if !cards}
		<ul class="list" aria-busy="true" aria-label="Carregando coleções">
			{#each [0, 1] as n (n)}
				<li class="card skeleton" aria-hidden="true">
					<div class="thumbs"><span></span><span></span><span></span></div>
					<div class="line wide"></div>
					<div class="line short"></div>
				</li>
			{/each}
		</ul>
	{:else if videos && videos.length === 0 && collections && collections.length === 0}
		<section class="empty">
			<h2>Nada aqui ainda.</h2>
			<p>Cole o link de um vídeo do YouTube, de um Shorts ou de um arquivo .mp4.</p>
			<a class="pill" href="/add">Colar um link</a>
		</section>
	{:else}
		<ul class="list">
			{#each cards as c (c.key)}
				<li>
					<a class="card" href={c.href} data-collection={c.key}>
						<div class="thumbs">
							{#each [0, 1, 2] as i (i)}
								<span>
									{#if c.items[i]?.thumbnail}
										<img
											src={c.items[i].thumbnail}
											alt=""
											loading="lazy"
											referrerpolicy="no-referrer"
											onerror={(e) => ((e.currentTarget as HTMLElement).style.display = 'none')}
										/>
									{/if}
								</span>
							{/each}
						</div>
						<h2 class="title">{c.name}</h2>
						<p class="count">{count(c.items.length)}</p>
					</a>
				</li>
			{/each}
			<li>
				<a class="card new" href="/c/new">
					<span class="plus"><Icon name="plus" size={22} /></span>
					<span class="title">Nova coleção</span>
				</a>
			</li>
		</ul>
	{/if}
</main>

<style>
	.library {
		min-height: 100svh;
		background: var(--color-bg-light);
		color: var(--color-text-light);
		padding: calc(var(--space-9) + env(safe-area-inset-top)) var(--space-4) var(--space-10);
	}

	header,
	.list,
	.empty {
		max-width: var(--layout-content-max);
		margin-inline: auto;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 var(--space-1) var(--space-6);
	}

	.spacer {
		width: var(--layout-touch-min);
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
		padding: var(--space-4) var(--space-4) var(--space-5);
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

	.thumbs img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.title {
		display: block;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: var(--size-h2);
		line-height: 1.12;
		letter-spacing: -0.01em;
		padding: var(--space-4) var(--space-1) 0;
	}

	.count {
		font-size: var(--size-meta);
		color: var(--color-muted-on-light);
		padding: var(--space-1) var(--space-1) 0;
	}

	.card.new {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		background: transparent;
		border: 2px dashed #cfcfcf;
	}

	.card.new .title {
		padding: 0;
	}

	.plus {
		width: var(--layout-touch-min);
		height: var(--layout-touch-min);
		border-radius: var(--radius-pill);
		background: var(--color-surface-light-button);
		display: inline-flex;
		align-items: center;
		justify-content: center;
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

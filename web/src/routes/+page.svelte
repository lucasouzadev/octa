<script lang="ts">
	import { library, type Video } from '#lib/db/index.ts';
	import Icon from '#lib/ui/Icon.svelte';

	let videos = $state<Video[] | null>(null);

	$effect(() => {
		library()
			.then((lib) => lib.list())
			.then((list) => (videos = list));
	});

	const sourceLabel: Record<Video['source'], string> = { youtube: 'YouTube', direct: 'Arquivo' };
	const kindLabel = (v: Video) => (v.kind === 'short' ? 'Shorts' : sourceLabel[v.source]);
</script>

<main class="library">
	<header>
		<span class="spacer" aria-hidden="true"></span>
		<div class="heading">
			<h1>Minha coleção</h1>
			{#if videos}
				<p>{videos.length === 1 ? '1 vídeo' : `${videos.length} vídeos`}</p>
			{/if}
		</div>
		<a class="icon-button" href="/add" aria-label="Adicionar link"><Icon name="plus" /></a>
	</header>

	{#if videos && videos.length === 0}
		<section class="empty">
			<h2>Nada aqui ainda.</h2>
			<p>Cole o link de um vídeo do YouTube, de um Shorts ou de um arquivo .mp4.</p>
			<a class="pill" href="/add">Colar um link</a>
		</section>
	{:else if videos}
		<ul class="list">
			{#each videos as v (v.id)}
				<li>
					<a class="card" href={`/v/${v.id}`}>
						<div class="thumb">
							{#if v.thumbnail}
								<img src={v.thumbnail} alt="" loading="lazy" referrerpolicy="no-referrer" />
							{/if}
							<span class="play"><Icon name="play" size={16} /></span>
						</div>
						<div class="meta">
							<span class="label">{kindLabel(v)}</span>
							{#if v.health === 'dead' || v.health === 'restricted'}
								<span class="label dead">Fora do ar</span>
							{/if}
						</div>
						<h2 class="title">{v.title}</h2>
						{#if v.author}<p class="author">{v.author}</p>{/if}
					</a>
				</li>
			{/each}
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

	.thumb {
		position: relative;
		aspect-ratio: 16 / 9;
		border-radius: calc(var(--radius-card) - var(--space-4));
		overflow: hidden;
		background: #2b2b2b;
	}

	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.play {
		position: absolute;
		left: 50%;
		top: 50%;
		translate: -50% -50%;
		width: 44px;
		height: 44px;
		border-radius: var(--radius-pill);
		background: rgb(255 255 255 / 0.92);
		color: var(--color-text-light);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.meta {
		display: flex;
		justify-content: space-between;
		padding: var(--space-4) var(--space-1) 0;
		color: var(--color-muted-on-light);
	}

	.dead {
		color: var(--color-status-dead);
	}

	.title {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: var(--size-h2);
		line-height: 1.12;
		letter-spacing: -0.01em;
		padding: var(--space-2) var(--space-1) 0;
	}

	.author {
		font-size: var(--size-meta);
		color: var(--color-muted-on-light);
		padding: var(--space-1) var(--space-1) 0;
	}

	@container (min-width: 560px) {
		.title {
			font-size: var(--size-title);
		}
	}
</style>

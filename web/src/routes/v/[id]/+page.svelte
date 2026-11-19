<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { library, type Video } from '#lib/db/index.ts';
	import { ALL, playlistFor } from '#lib/db/scope.ts';
	import Icon from '#lib/ui/Icon.svelte';
	import Player from '#lib/ui/Player.svelte';

	let all = $state<Video[] | null>(null);
	let scope = $state(ALL);
	let notice = $state('');

	const id = $derived(page.params.id);
	const requestedScope = $derived(page.url.searchParams.get('c'));
	// Links inside the player keep the collection the person came from.
	const at = (videoId: string) => `/v/${videoId}?c=${scope}`;
	const index = $derived(all ? all.findIndex((v) => v.id === id) : -1);
	const video = $derived(index >= 0 && all ? all[index] : undefined);

	$effect(() => {
		const wanted = requestedScope;
		const videoId = id;
		if (!videoId) return;
		library()
			.then((lib) => playlistFor(lib, wanted, videoId))
			.then((p) => {
				all = p.videos;
				scope = p.scope;
			});
	});

	$effect(() => {
		const current = video;
		if (!current) return;
		library().then((lib) => lib.update(current.id, { lastOpenedAt: new Date().toISOString() }));
	});

	const sourceLabel = (v: Video) => (v.kind === 'short' ? 'Shorts' : v.source === 'youtube' ? 'YouTube' : 'Arquivo');

	function next() {
		if (!all || all.length < 2) return;
		goto(at(all[(index + 1) % all.length].id), { replaceState: true });
	}

	async function toggleFavorite() {
		if (!video || !all) return;
		const updated = await (await library()).update(video.id, { favorite: !video.favorite });
		all[index] = updated;
	}

	async function share() {
		if (!video) return;
		try {
			if (navigator.share) {
				await navigator.share({ title: video.title, url: video.canonicalUrl });
				return;
			}
			await navigator.clipboard.writeText(video.canonicalUrl);
			flash('Link copiado');
		} catch (e) {
			if ((e as DOMException)?.name !== 'AbortError') flash('Não deu para compartilhar');
		}
	}

	function flash(text: string) {
		notice = text;
		setTimeout(() => (notice = ''), 2200);
	}
</script>

<main class="player on-dark">
	<header>
		<a class="icon-button" href={scope === ALL && !requestedScope ? '/' : `/c/${scope}`} aria-label="Fechar"><Icon name="close" /></a>
		{#if video}<span class="label source">{sourceLabel(video)}</span>{/if}
	</header>

	{#if all && !video}
		<section class="missing">
			<h1>Esse vídeo não está na sua coleção.</h1>
			<a href="/add">Colar um link</a>
		</section>
	{:else if video}
		<section class="stage">
			{#key video.id}
				<Player {video} />
			{/key}

			<div class="info">
				{#if video.author}<p class="author">{video.author}</p>{/if}
				<h1>{video.title}</h1>
				{#if video.health === 'dead' || video.health === 'restricted'}
					<p class="label dead">{video.health === 'dead' ? 'Fora do ar' : 'Com restrição'}</p>
				{/if}
			</div>

			<div class="actions">
				<button type="button" aria-label="Próximo vídeo" onclick={next} disabled={all!.length < 2}>
					<Icon name="next" size={22} />
				</button>
				<button
					type="button"
					aria-label="Salvar nos favoritos"
					aria-pressed={video.favorite}
					onclick={toggleFavorite}
				>
					<Icon name="heart" size={22} filled={video.favorite} />
				</button>
				<button type="button" aria-label="Compartilhar" onclick={share}>
					<Icon name="share" size={22} />
				</button>
			</div>
			<p class="notice" role="status">{notice}</p>
		</section>

		{#if all && all.length > 1}
			<nav class="timeline" aria-label="Linha do tempo">
				<ol>
					{#each all as v (v.id)}
						<li>
							<a
								href={at(v.id)}
								data-sveltekit-replacestate
								aria-label={v.title}
								aria-current={v.id === video.id ? 'true' : undefined}
							>
								{#if v.thumbnail}<img src={v.thumbnail} alt="" loading="lazy" referrerpolicy="no-referrer" />{/if}
							</a>
						</li>
					{/each}
				</ol>
			</nav>
		{/if}
	{/if}
</main>

<style>
	.player {
		min-height: 100svh;
		background: var(--color-bg-dark);
		color: var(--color-text-dark);
		padding: calc(var(--space-6) + env(safe-area-inset-top)) var(--screen-pad)
			calc(var(--space-6) + env(safe-area-inset-bottom));
		display: flex;
		flex-direction: column;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.source {
		color: var(--color-muted-on-dark);
	}

	.stage,
	.missing {
		flex: 1;
		width: 100%;
		max-width: var(--layout-content-max);
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: var(--space-6);
		padding-block: var(--space-6);
	}

	.missing h1 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: var(--size-title);
	}

	.missing a {
		color: var(--color-text-dark);
	}

	.info {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.author {
		font-family: var(--font-display);
		font-size: 19px;
		color: var(--color-muted-on-dark);
	}

	.info h1 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: var(--size-title);
		line-height: 1.12;
		letter-spacing: -0.01em;
	}

	.dead {
		color: var(--color-action-alert);
	}

	.actions {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-2);
	}

	.actions button {
		height: 62px;
		border: none;
		border-radius: var(--radius-pill);
		background: var(--color-surface-dark);
		color: var(--color-text-dark);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform var(--motion-press);
	}

	.actions button:active:not(:disabled) {
		transform: scale(0.97);
	}

	.actions button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.notice {
		min-height: 1.4em;
		text-align: center;
		font-size: var(--size-meta);
		color: var(--color-muted-on-dark);
	}

	.timeline {
		overflow-x: auto;
		scrollbar-width: none;
		padding-top: var(--space-4);
	}

	.timeline ol {
		list-style: none;
		margin: 0 auto;
		padding: 0 var(--space-2);
		display: flex;
		align-items: flex-end;
		justify-content: center;
		gap: var(--space-2);
		width: max-content;
		min-width: 100%;
	}

	.timeline a {
		display: block;
		width: 46px;
		height: 46px;
		border-radius: 9px;
		overflow: hidden;
		background: #2b2b2b;
		border: 1px solid #2a2a2a;
		opacity: 0.7;
		transition:
			width var(--motion-press),
			height var(--motion-press);
	}

	.timeline a[aria-current='true'] {
		width: 56px;
		height: 66px;
		border-radius: var(--radius-thumb);
		border: 2px solid var(--color-text-dark);
		opacity: 1;
	}

	.timeline img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>

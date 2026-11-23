<script lang="ts">
	import { platformOf } from '#lib/platform.ts';
	import { cardLabel } from '#lib/fan.ts';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { library, type Video } from '#lib/db/index.ts';
	import { ALL, playlistFor } from '#lib/db/scope.ts';
	import { enrichVideo, needsEnrich } from '#lib/enrich.ts';
	import { checkVideo, recheck } from '#lib/health.ts';
	import DangerScreen from '#lib/ui/DangerScreen.svelte';
	import EditVideoSheet from '#lib/ui/EditVideoSheet.svelte';
	import HeartBurst from '#lib/ui/HeartBurst.svelte';
	import Icon from '#lib/ui/Icon.svelte';
	import MoreSheet from '#lib/ui/MoreSheet.svelte';
	import MoveSheet from '#lib/ui/MoveSheet.svelte';
	import Cinema from '#lib/ui/Cinema.svelte';
	import { toast } from '#lib/toast.svelte.ts';

	let all = $state<Video[] | null>(null);
	let scope = $state(ALL);
	let moving = $state<Video | null>(null);
	let likes = $state(0);
	let more = $state<Video | null>(null);
	let editing = $state<Video | null>(null);
	let removing = $state(false);
	let removeBusy = $state(false);
	let removeError = $state('');
	let keptDead = $state<string | null>(null); // dead-link screen dismissed for this video

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

	// Keyed on the id: progress saves replace the video object and must not re-stamp this.
	const openedId = $derived(video?.id);
	$effect(() => {
		const opened = openedId;
		if (!opened) return;
		library().then((lib) => lib.update(opened, { lastOpenedAt: new Date().toISOString() }));
	});

	// Before playing: a link not checked in the last 24 h is checked once (SPEC §5).
	// The check never blocks playback; its answer lands on the screen when it arrives.
	let checkedOnOpen = '';
	$effect(() => {
		const current = video;
		if (!current || checkedOnOpen === current.id) return;
		checkedOnOpen = current.id;
		library()
			.then((lib) => checkVideo(lib, current))
			.then((updated) => {
				if (updated !== current) replace(updated);
			});
	});

	// A link saved while the API was asleep still has the parser's title. The API is waking up
	// now: ask again for this video and let the answer land on the screen (R4.1).
	let enrichedOnOpen = '';
	$effect(() => {
		const current = video;
		if (!current || enrichedOnOpen === current.id || !needsEnrich(current)) return;
		enrichedOnOpen = current.id;
		library()
			.then((lib) => enrichVideo(lib, current))
			.then((updated) => {
				if (updated) replace(updated);
			});
	});

	const sourceLabel = (v: Video) => (v.source === 'direct' ? 'Arquivo' : cardLabel(v));
	const theme = $derived(video ? platformOf(video) : null);
	// R7.3b: for a moment after liking, the heart is the platform's icon.
	let morph = $state(false);
	let morphTimer = 0;

	function next() {
		if (!all || all.length < 2) return;
		goto(at(all[(index + 1) % all.length].id), { replaceState: true });
	}

	async function toggleFavorite() {
		if (!video || !all) return;
		const liking = !video.favorite;
		const updated = await (await library()).update(video.id, { favorite: liking });
		all[index] = updated;
		if (liking) {
			likes += 1; // hearts only go up when liking, not when taking it back
			morph = true;
			clearTimeout(morphTimer);
			morphTimer = window.setTimeout(() => (morph = false), 800);
		}
	}

	// Everything below keeps the list the player walks in step with what was saved.
	function replace(updated: Video) {
		const at = all ? all.findIndex((v) => v.id === updated.id) : -1;
		if (all && at >= 0) all[at] = updated;
	}

	async function toggleWatched() {
		if (!video) return;
		const watched = !video.watched;
		replace(await (await library()).update(video.id, { watched }));
		toast.show(watched ? 'Marcado como assistido' : 'Desmarcado como assistido');
	}

	// "Continuar assistindo": where the person stopped, kept on the video (null = finished).
	// Takes the id the player was opened with: leaving the screen saves too, and by then
	// `video` already points at the next one.
	async function saveProgress(videoId: string, sec: number | null, duration: number) {
		try {
			const lib = await library();
			const known = await lib.get(videoId);
			if (!known) return;
			const patch: Partial<Video> = { positionSec: sec === null ? undefined : Math.floor(sec) };
			if (!known.durationSec && duration > 0) patch.durationSec = Math.floor(duration);
			replace(await lib.update(videoId, patch));
		} catch {
			// the video was deleted while it played
		}
	}

	async function markWatched() {
		if (!video || video.watched) return;
		replace(await (await library()).update(video.id, { watched: true }));
	}

	async function remove() {
		if (!video || !all || removeBusy) return;
		removeBusy = true;
		removeError = '';
		try {
			const gone = video.id;
			const rest = all.filter((v) => v.id !== gone);
			const lib = await library();
			const removed = await lib.deleteVideo(gone);
			const back = at(gone);
			removing = false;
			toast.show('Vídeo apagado', {
				label: 'Desfazer',
				run: async () => {
					await lib.restoreVideo(removed);
					await goto(back, { replaceState: true });
				}
			});
			if (rest.length === 0) await goto(scope === ALL ? '/' : `/c/${scope}`, { replaceState: true });
			else await goto(at(rest[Math.min(index, rest.length - 1)].id), { replaceState: true });
		} catch {
			removeError = 'Não deu para apagar agora. Tente de novo.';
		} finally {
			removeBusy = false;
		}
	}

	// "Manter e checar de novo": dismiss the screen now, ask the platform again, and let
	// the answer land on the card. Never deletes; the streak restarts.
	async function keepDead() {
		if (!video) return;
		const current = video;
		keptDead = current.id;
		replace(await recheck(await library(), current));
	}

	// SPEC: dead twice in a row shows the orange screen; one failure only marks the card.
	const deadScreen = $derived(!!video && video.health === 'dead' && video.deadStreak >= 2 && keptDead !== video.id);

	async function share() {
		if (!video) return;
		try {
			if (navigator.share) {
				await navigator.share({ title: video.title, url: video.canonicalUrl });
				return;
			}
			await navigator.clipboard.writeText(video.canonicalUrl);
			toast.show('Link copiado');
		} catch (e) {
			if ((e as DOMException)?.name !== 'AbortError') toast.show('Não deu para compartilhar');
		}
	}
</script>

<main class="player on-dark" data-platform={theme?.key} style={theme ? `--platform: ${theme.color}` : undefined}>
	<header>
		<a class="icon-button" href={scope === ALL && !requestedScope ? '/' : `/c/${scope}`} aria-label="Fechar"><Icon name="close" /></a>
		{#if video}
			<span class="label source"><Icon name={theme!.icon} size={16} />{sourceLabel(video)}</span>
			<button class="icon-button" type="button" aria-label="Mais ações" onclick={() => (more = video)}>
				<Icon name="more" />
			</button>
		{/if}
	</header>

	{#if all && !video}
		<section class="missing">
			<h1>Esse vídeo não está na sua coleção.</h1>
			<a href="/add">Colar um link</a>
		</section>
	{:else if video}
		<section class="stage">
			{#key `${video.id}|${video.canonicalUrl}`}
				{@const playing = video.id}
				<Cinema {video} onended={markWatched} onprogress={(sec, dur) => saveProgress(playing, sec, dur)} />
			{/key}

			<div class="info">
				{#if video.author}<p class="author">{video.author}</p>{/if}
				<h1>{video.title}</h1>
				{#if video.health === 'dead' || video.health === 'restricted'}
					<p class="label dead">{video.health === 'dead' ? 'Fora do ar' : 'Com restrição'}</p>
				{/if}
			</div>

			<div class="actions">
				<button type="button" aria-label="Compartilhar" onclick={share}>
					<Icon name="share" size={22} />
				</button>
				<button type="button" aria-label="Mover" onclick={() => (moving = video)}>
					<Icon name="move" size={22} />
				</button>
				<button type="button" class="like" aria-label="Curtir" aria-pressed={video.favorite} data-glyph={morph ? theme!.key : 'heart'} onclick={toggleFavorite}>
					<Icon name={morph ? theme!.icon : 'heart'} size={22} filled={video.favorite && !morph} />
					<HeartBurst fire={likes} icon={theme!.icon} color={theme!.color} platform={theme!.key} />
				</button>
				<button type="button" aria-label="Próximo vídeo" onclick={next} disabled={all!.length < 2}>
					<Icon name="next" size={22} />
				</button>
			</div>
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

{#if video && (deadScreen || removing)}
	{#if removing}
		<DangerScreen
			title="Apagar este vídeo?"
			body="Ele sai da sua biblioteca e das coleções. O link original não é afetado."
			confirmLabel="Apagar vídeo"
			thumb={video.thumbnail}
			busy={removeBusy}
			error={removeError}
			onconfirm={remove}
			oncancel={() => (removing = false)}
		/>
	{:else}
		<DangerScreen
			title="Esse vídeo saiu do ar."
			body="O link não responde mais. Apague da biblioteca ou mantenha e a gente confere de novo depois."
			confirmLabel="Apagar da biblioteca"
			cancelLabel="Manter e checar de novo"
			thumb={video.thumbnail}
			busy={removeBusy}
			error={removeError}
			onconfirm={() => (removing = true)}
			oncancel={keepDead}
		/>
	{/if}
{/if}

<MoreSheet
	video={more}
	onclose={() => (more = null)}
	onwatched={toggleWatched}
	onedit={() => (editing = video ?? null)}
	onremove={() => (removing = true)}
/>

<EditVideoSheet video={editing} onclose={() => (editing = null)} onsaved={replace} />

<MoveSheet
	video={moving}
	onclose={() => (moving = null)}
	onmoved={(target) => video && goto(`/v/${video.id}?c=${target ?? ALL}`, { replaceState: true })}
/>

<style>
.player {
		/* Exactly one screen tall: the video takes what is left, nothing scrolls. */
		height: 100svh;
		height: 100dvh;
		overflow: hidden;
		background: var(--color-bg-dark);
		color: var(--color-text-dark);
		padding: calc(var(--space-4) + env(safe-area-inset-top)) var(--screen-pad)
			calc(var(--space-3) + env(safe-area-inset-bottom));
		display: flex;
		flex-direction: column;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.source {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--platform, var(--color-muted-on-dark));
	}

	.stage,
	.missing {
		flex: 1;
		min-height: 0;

		width: 100%;
		max-width: var(--layout-content-max);
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding-block: var(--space-4) 0;
	}

	.missing {
		justify-content: center;
	}

	/* The video gets whatever height the rest leaves, and is sized to fit it. */

	.missing h1 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: var(--size-title);
	}

	.missing a {
		color: var(--color-text-dark);
	}

	.info {
		flex: none;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
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
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	@media (max-height: 720px) {
		.info h1 {
			font-size: 24px;
		}
		.author {
			font-size: 16px;
		}
	}

	.dead {
		color: var(--color-action-alert);
	}

	.actions {
		flex: none;
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--space-2);
	}

	.actions button {
		position: relative;
		height: 56px;
		border: none;
		border-radius: var(--radius-pill);
		background: var(--color-surface-dark);
		color: var(--color-text-dark);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform var(--motion-press);
	}

	.actions .like[data-glyph]:not([data-glyph='heart']) {
		color: var(--platform);
	}

	.actions button:active:not(:disabled) {
		transform: scale(0.97);
	}

	.actions button:disabled {
		opacity: 0.4;
		cursor: default;
	}


	.timeline {
		flex: none;
		overflow-x: auto;
		scrollbar-width: none;
		padding-top: var(--space-3);
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

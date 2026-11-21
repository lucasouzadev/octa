<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { library } from '#lib/db/index.ts';
	import { warmUp } from '#lib/api.ts';
	import { addLink } from '#lib/links.ts';
	import { sharedLink } from '#lib/share.ts';
	import { LinkError } from '#lib/providers/parse.ts';
	import Icon from '#lib/ui/Icon.svelte';
	import TextField from '#lib/ui/TextField.svelte';

	// The share target (and bookmarklets) prefill the field with ?url= / ?text= / ?title=.
	let value = $state(sharedLink(page.url.searchParams));
	let error = $state('');
	let busy = $state(false);
	let slow = $state(false); // still waiting after a few seconds: say why

	onMount(() => warmUp());

	const messages = {
		invalid_url: 'Isso não parece um link. Confira e tente de novo.',
		unsupported_url: 'Esse tipo de link ainda não é suportado. Por enquanto: YouTube, Shorts, Reels, TikTok e arquivos de vídeo (.mp4, .webm).',
		resolver_unavailable: 'Não consegui abrir o link curto do TikTok agora. Tente de novo em instantes ou cole o link completo do vídeo.'
	};

	// One tap instead of long-press, select, paste. The browser may ask permission.
	async function pasteFromClipboard() {
		error = '';
		try {
			const text = (await navigator.clipboard.readText()).trim();
			if (text) value = text;
			else error = 'A área de transferência está vazia.';
		} catch {
			error = 'Não consegui ler a área de transferência. Toque no campo e cole.';
		}
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (busy) return;
		error = '';
		busy = true;
		const timer = setTimeout(() => (slow = true), 3000);
		try {
			const { video } = await addLink(value, { library: await library() });
			await goto(`/v/${video.id}`);
		} catch (e) {
			error = e instanceof LinkError ? messages[e.code] : 'Não deu para salvar agora. Tente de novo.';
		} finally {
			clearTimeout(timer);
			slow = false;
			busy = false;
		}
	}
</script>

<main class="paste on-blue">
	<header>
		<span class="mark"><Icon name="link" size={32} /></span>
		<a class="close" href="/" aria-label="Voltar para a biblioteca"><Icon name="close" /></a>
	</header>

	<div class="intro">
		<h1>Cole um link.<span>O resto é com a gente.</span></h1>
		<p>Nada sobe, nada baixa. O vídeo fica aqui enquanto o link existir.</p>
	</div>

	<form onsubmit={submit} novalidate>
		<TextField
			id="link"
			label="Link do vídeo"
			bind:value
			type="url"
			inputmode="url"
			autocapitalize="off"
			spellcheck={false}
			placeholder="youtube.com/watch?v=…"
			hint="YouTube · Shorts · Reels · TikTok · .mp4"
			{error}
			{busy}
			onpaste={pasteFromClipboard}
		/>
		<button class="cta" type="submit" disabled={busy || !value.trim()}>
			{busy ? (slow ? 'Acordando o servidor…' : 'Gerando…') : 'Gerar player'}
			<Icon name="arrow" />
		</button>
	</form>
</main>

<style>
	.paste {
		--fg: var(--color-text-dark);
		min-height: 100svh;
		min-height: 100dvh;
		background: var(--color-action-create);
		color: var(--fg);
		padding: calc(var(--space-3) + env(safe-area-inset-top)) var(--screen-pad)
			calc(var(--space-6) + env(safe-area-inset-bottom));
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		max-width: 100%;
	}

	/* Under the page, edge to edge: when the browser pans the page for the keyboard, only blue shows. */
	.paste::before {
		content: '';
		position: fixed;
		inset: 0;
		z-index: -1;
		background: var(--color-action-create);
	}

	/* The mark on the left and the X on the right share one line. */
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		max-width: var(--layout-content-max);
		margin-inline: auto;
	}

	.mark {
		display: inline-flex;
		align-items: center;
		height: var(--layout-touch-min);
	}

	.close {
		width: var(--layout-touch-min);
		height: var(--layout-touch-min);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-pill);
		background: rgb(255 255 255 / 0.14);
		color: var(--fg);
	}

	.intro,
	form {
		width: 100%;
		max-width: var(--layout-content-max);
		margin-inline: auto;
	}

	.intro {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
	}

	h1 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: var(--size-display);
		line-height: 1.02;
		letter-spacing: -0.02em;
	}

	h1 span {
		display: block;
		color: rgb(255 255 255 / 0.86);
	}

	.intro p {
		line-height: 1.45;
		max-width: 34ch;
		color: rgb(255 255 255 / 0.9);
	}

	form {
		margin-top: auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}



	.cta {
		margin-top: var(--space-6);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-3);
		height: 60px;
		border: none;
		border-radius: var(--radius-pill);
		background: var(--color-text-dark);
		color: var(--color-action-create);
		font-size: var(--size-body);
		font-weight: 600;
		transition: transform var(--motion-press);
	}

	.cta:active:not(:disabled) {
		transform: scale(0.97);
	}

	.cta:disabled {
		opacity: 0.7;
		cursor: default;
	}

	.cta:focus-visible {
		outline-color: var(--fg);
		outline-offset: 3px;
	}
</style>

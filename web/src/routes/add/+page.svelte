<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { library } from '#lib/db/index.ts';
	import { addLink } from '#lib/links.ts';
	import { LinkError } from '#lib/providers/parse.ts';
	import DockedInput from '#lib/ui/DockedInput.svelte';
	import Icon from '#lib/ui/Icon.svelte';

	// ?url= lets the share target (slice 4) and bookmarklets prefill the field.
	let value = $state(page.url.searchParams.get('url') ?? '');
	let error = $state('');
	let busy = $state(false);

	const messages = {
		invalid_url: 'Isso não parece um link. Confira e tente de novo.',
		unsupported_url: 'Esse tipo de link ainda não é suportado. Por enquanto: YouTube, Shorts e arquivos .mp4.'
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
		try {
			const { video } = await addLink(value, { library: await library() });
			await goto(`/v/${video.id}`);
		} catch (e) {
			error = e instanceof LinkError ? messages[e.code] : 'Não deu para salvar agora. Tente de novo.';
		} finally {
			busy = false;
		}
	}
</script>

<main class="paste on-blue">
	<header>
		<a class="close" href="/" aria-label="Voltar para a biblioteca"><Icon name="close" /></a>
	</header>

	<div class="intro">
		<Icon name="link" size={40} />
		<h1>Cole um link.<span>O resto é com a gente.</span></h1>
		<p>Nada sobe, nada baixa. O vídeo fica aqui enquanto o link existir.</p>
	</div>

	<form onsubmit={submit} novalidate>
		<DockedInput
			id="link"
			label="Link do vídeo"
			bind:value
			type="url"
			inputmode="url"
			autocapitalize="off"
			spellcheck={false}
			placeholder="youtube.com/watch?v=…"
			hint="YouTube · Shorts · .mp4 — Reels e TikTok chegam em breve"
			{error}
			{busy}
			sendLabel="Enviar"
			onpaste={pasteFromClipboard}
		/>
		<button class="cta" type="submit" disabled={busy || !value.trim()}>
			{busy ? 'Gerando…' : 'Gerar player'}
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

	/* The close button sits on the right so the title can start higher. */
	header {
		display: flex;
		justify-content: flex-end;
		width: 100%;
		max-width: var(--layout-content-max);
		margin-inline: auto;
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

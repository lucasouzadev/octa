<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { library } from '#lib/db/index.ts';
	import { addLink } from '#lib/links.ts';
	import { LinkError } from '#lib/providers/parse.ts';
	import Icon from '#lib/ui/Icon.svelte';

	// ?url= lets the share target (slice 4) and bookmarklets prefill the field.
	let value = $state(page.url.searchParams.get('url') ?? '');
	let error = $state('');
	let busy = $state(false);

	const messages = {
		invalid_url: 'Isso não parece um link. Confira e tente de novo.',
		unsupported_url: 'Esse tipo de link ainda não é suportado. Por enquanto: YouTube, Shorts e arquivos .mp4.'
	};

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

<main class="paste">
	<a class="close" href="/" aria-label="Voltar para a coleção"><Icon name="close" /></a>

	<div class="intro">
		<Icon name="link" size={40} />
		<h1>Cole um link.<span>O resto é com a gente.</span></h1>
		<p>Nada sobe, nada baixa. O vídeo fica aqui enquanto o link existir.</p>
	</div>

	<form onsubmit={submit} novalidate>
		<label class="label" for="link">Link do vídeo</label>
		<input
			id="link"
			name="link"
			type="url"
			inputmode="url"
			autocomplete="off"
			autocapitalize="off"
			spellcheck="false"
			placeholder="youtube.com/watch?v=…"
			bind:value
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={error ? 'link-error' : 'link-hint'}
		/>
		{#if error}
			<p id="link-error" class="error" role="alert">{error}</p>
		{:else}
			<p id="link-hint" class="hint">YouTube · Shorts · .mp4 — Reels e TikTok chegam em breve</p>
		{/if}
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
		background: var(--color-action-create);
		color: var(--fg);
		padding: calc(var(--space-6) + env(safe-area-inset-top)) var(--screen-pad)
			calc(var(--space-8) + env(safe-area-inset-bottom));
		display: grid;
		grid-template-rows: auto 1fr auto;
		gap: var(--space-8);
		max-width: 100%;
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
		align-self: center;
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
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	input {
		background: transparent;
		border: none;
		border-bottom: 2px solid rgb(255 255 255 / 0.5);
		border-radius: 0;
		padding: var(--space-3) 0 var(--space-4);
		font-size: 22px;
		color: var(--fg);
		outline: none;
	}

	input::placeholder {
		color: rgb(255 255 255 / 0.72);
	}

	input:focus-visible {
		border-bottom-color: var(--fg);
	}

	.hint,
	.error {
		font-size: var(--size-meta);
		line-height: 1.4;
		color: rgb(255 255 255 / 0.88);
	}

	.error {
		color: var(--fg);
		font-weight: 600;
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

<script lang="ts">
	import { goto } from '$app/navigation';
	import { CollectionError, COLLECTION_NAME_MAX, library } from '#lib/db/index.ts';
	import Icon from '#lib/ui/Icon.svelte';

	let name = $state('');
	let error = $state('');
	let busy = $state(false);

	const messages = {
		empty_name: 'Dê um nome à coleção.',
		name_too_long: `Use até ${COLLECTION_NAME_MAX} caracteres.`,
		reserved_name: '"Todos" já existe. Escolha outro nome.',
		not_found: 'Não deu para criar agora. Tente de novo.',
		bad_order: 'Não deu para criar agora. Tente de novo.'
	};

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (busy) return;
		error = '';
		busy = true;
		try {
			const c = await (await library()).createCollection(name);
			await goto(`/c/${c.id}`, { replaceState: true });
		} catch (e) {
			error = e instanceof CollectionError ? messages[e.code] : 'Não deu para criar agora. Tente de novo.';
		} finally {
			busy = false;
		}
	}
</script>

<main class="create">
	<a class="close" href="/" aria-label="Voltar para a coleção"><Icon name="close" /></a>

	<div class="intro">
		<h1>Nova coleção.<span>Como vai se chamar?</span></h1>
		<p>Os vídeos continuam em Todos. A coleção só organiza e define a ordem de assistir.</p>
	</div>

	<form onsubmit={submit} novalidate>
		<label class="label" for="name">Nome da coleção</label>
		<input
			id="name"
			name="name"
			type="text"
			autocomplete="off"
			maxlength={COLLECTION_NAME_MAX + 10}
			placeholder="Receitas, música, estudos…"
			bind:value={name}
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={error ? 'name-error' : undefined}
		/>
		{#if error}<p id="name-error" class="error" role="alert">{error}</p>{/if}
		<button class="cta" type="submit" disabled={busy || !name.trim()}>
			{busy ? 'Criando…' : 'Criar coleção'}
			<Icon name="arrow" />
		</button>
	</form>
</main>

<style>
	.create {
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

	.error {
		font-size: var(--size-meta);
		line-height: 1.4;
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

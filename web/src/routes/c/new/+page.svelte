<script lang="ts">
	import { goto } from '$app/navigation';
	import { CollectionError, COLLECTION_NAME_MAX, library } from '#lib/db/index.ts';
	import DockedInput from '#lib/ui/DockedInput.svelte';
	import Icon from '#lib/ui/Icon.svelte';

	let name = $state('');
	let error = $state('');
	let busy = $state(false);

	const messages = {
		empty_name: 'Dê um nome à coleção.',
		name_too_long: `Use até ${COLLECTION_NAME_MAX} caracteres.`,
		reserved_name: 'Esse nome é reservado (Todos, Favoritos, Assistidos). Escolha outro.',
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

<main class="create on-blue">
	<header>
		<a class="close" href="/" aria-label="Voltar para a biblioteca"><Icon name="close" /></a>
	</header>

	<div class="intro">
		<h1>Nova coleção.<span>Como vai se chamar?</span></h1>
		<p>Os vídeos continuam em Todos. A coleção só organiza e define a ordem de assistir.</p>
	</div>

	<form onsubmit={submit} novalidate>
		<DockedInput
			id="name"
			label="Nome da coleção"
			bind:value={name}
			placeholder="Receitas, música, estudos…"
			maxlength={COLLECTION_NAME_MAX + 10}
			{error}
			{busy}
			sendLabel="Enviar"
		/>
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

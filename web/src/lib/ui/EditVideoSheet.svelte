<script lang="ts">
	import { toast } from '#lib/toast.svelte.ts';
	import { library, type Video } from '#lib/db/index.ts';
	import { editVideo, EditError } from '#lib/links.ts';
	import { LinkError } from '#lib/providers/parse.ts';
	import Sheet from '#lib/ui/Sheet.svelte';

	// Correct a saved link: rename it, or swap the link for a fixed one.
	let {
		video,
		onclose,
		onsaved
	}: { video: Video | null; onclose: () => void; onsaved: (video: Video) => void } = $props();

	let title = $state('');
	let url = $state('');
	let error = $state('');
	let busy = $state(false);

	$effect(() => {
		if (!video) return;
		title = video.title;
		url = video.url;
		error = '';
	});

	const messages: Record<string, string> = {
		empty_title: 'Dê um título ao vídeo.',
		title_too_long: 'Use até 300 caracteres no título.',
		duplicate: 'Esse link já está na sua biblioteca.',
		not_found: 'Esse vídeo não existe mais.'
	};

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (!video || busy) return;
		busy = true;
		error = '';
		try {
			const saved = await editVideo(video.id, { title, url }, { library: await library() });
			onclose();
			toast.show('Alterações salvas');
			onsaved(saved);
		} catch (e) {
			error =
				e instanceof EditError
					? messages[e.code]
					: e instanceof LinkError
						? e.code === 'resolver_unavailable'
							? 'Não consegui abrir o link curto do TikTok agora. Tente de novo em instantes ou cole o link completo do vídeo.'
							: 'Isso não parece um link que o app reconheça. Confira e tente de novo.'
						: 'Não deu para salvar agora. Tente de novo.';
		} finally {
			busy = false;
		}
	}
</script>

<Sheet open={video !== null} title="Editar vídeo" {onclose}>
	{#if video}
		<form onsubmit={save} novalidate>
			<label for="edit-title">Título</label>
			<input id="edit-title" type="text" bind:value={title} autocomplete="off" maxlength="310" />
			<label for="edit-url">Link</label>
			<input
				id="edit-url"
				type="url"
				inputmode="url"
				bind:value={url}
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
			/>
			{#if error}<p class="error" role="alert">{error}</p>{/if}
			<button class="save" type="submit" disabled={busy || !title.trim() || !url.trim()}>
				{busy ? 'Salvando…' : 'Salvar'}
			</button>
		</form>
	{/if}
</Sheet>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	label {
		padding: var(--space-2) var(--space-2) 0;
		color: var(--color-muted-on-dark);
		font-size: var(--size-meta);
		font-weight: 600;
	}

	input {
		width: 100%;
		height: 56px;
		padding: 0 var(--space-5);
		border: none;
		border-radius: 18px;
		background: var(--color-surface-dark-raised);
		color: var(--color-text-dark);
	}

	.error {
		color: var(--color-action-alert);
		font-size: var(--size-meta);
		font-weight: 600;
		padding: 0 var(--space-2);
	}

	.save {
		margin-top: var(--space-3);
		height: 56px;
		border: none;
		border-radius: var(--radius-pill);
		background: var(--color-text-dark);
		color: var(--color-text-light);
		font-weight: 600;
	}

	.save:disabled {
		opacity: 0.4;
	}
</style>

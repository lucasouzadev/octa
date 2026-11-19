<script lang="ts">
	import type { Video } from '#lib/db/index.ts';
	import Icon from '#lib/ui/Icon.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';

	// The viewer's "Mais": the things that are not one of the four main actions.
	let {
		video,
		onclose,
		onwatched,
		onedit,
		onremove
	}: {
		video: Video | null;
		onclose: () => void;
		onwatched: () => void;
		onedit: () => void;
		onremove: () => void;
	} = $props();

	// Close first, then act, so the next sheet or screen opens over a settled page.
	const run = (action: () => void) => () => {
		onclose();
		action();
	};
</script>

<Sheet open={video !== null} title="Mais" {onclose}>
	{#if video}
		<button class="option" type="button" onclick={run(onwatched)}>
			<Icon name={video.watched ? 'eye' : 'check'} size={20} />
			{video.watched ? 'Desmarcar como assistido' : 'Marcar como assistido'}
		</button>
		<button class="option" type="button" onclick={run(onedit)}>
			<Icon name="edit" size={20} /> Editar título ou link
		</button>
		<button class="option remove" type="button" onclick={run(onremove)}>
			<Icon name="trash" size={20} /> Apagar da biblioteca
		</button>
	{/if}
</Sheet>

<style>
	.option {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		width: 100%;
		min-height: 56px;
		padding: 0 var(--space-5);
		border: none;
		border-radius: var(--radius-pill);
		background: var(--color-surface-dark-raised);
		color: var(--color-text-dark);
		font-size: var(--size-body);
		font-weight: 600;
		text-align: left;
	}

	.remove {
		color: var(--color-action-alert);
	}
</style>

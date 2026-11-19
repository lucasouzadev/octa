<script lang="ts">
	import Icon from '#lib/ui/Icon.svelte';

	// The Library's "+": a popover that grows from the button itself. The plus turns
	// into a minus while open; the menu offers the two ways to create content.
	let open = $state(false);
	let root = $state<HTMLElement>();

	function onpointerdown(e: PointerEvent) {
		if (open && root && !root.contains(e.target as Node)) open = false;
	}

	function onkeydown(e: KeyboardEvent) {
		if (open && e.key === 'Escape') open = false;
	}
</script>

<svelte:window {onpointerdown} {onkeydown} />

<div class="create" bind:this={root}>
	<button
		class="icon-button toggle"
		type="button"
		aria-label={open ? 'Fechar menu de criação' : 'Criar conteúdo'}
		aria-expanded={open}
		aria-haspopup="menu"
		onclick={() => (open = !open)}
	>
		<Icon name={open ? 'minus' : 'plus'} />
	</button>

	{#if open}
		<div class="menu" role="menu" aria-label="Criar conteúdo">
			<a role="menuitem" href="/add" onclick={() => (open = false)}>
				<Icon name="link" size={20} />
				Colar link
			</a>
			<a role="menuitem" href="/c/new" onclick={() => (open = false)}>
				<Icon name="folder-plus" size={20} />
				Nova coleção
			</a>
		</div>
	{/if}
</div>

<style>
	.create {
		position: relative;
	}

	.menu {
		position: absolute;
		z-index: 60;
		top: calc(100% + var(--space-2));
		right: 0;
		min-width: 212px;
		display: flex;
		flex-direction: column;
		padding: var(--space-2);
		border-radius: 20px;
		background: var(--color-text-light);
		color: var(--color-text-dark);
		box-shadow: 0 4px 12px rgb(0 0 0 / 0.25), 0 16px 40px rgb(0 0 0 / 0.28);
		transform-origin: top right;
		animation: pop-in 180ms cubic-bezier(0.2, 0.9, 0.3, 1.1);
	}

	.menu a {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: var(--layout-touch-min);
		padding: 0 var(--space-4);
		border-radius: 14px;
		color: inherit;
		font-weight: 600;
		text-decoration: none;
	}

	.menu a:active,
	.menu a:focus-visible {
		background: rgb(255 255 255 / 0.14);
		outline: none;
	}

	@keyframes pop-in {
		from {
			opacity: 0;
			transform: scale(0.6);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.menu {
			animation: none;
		}
	}
</style>

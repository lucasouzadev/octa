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

<div class="create" class:open bind:this={root}>
	{#if open}
		<!-- The panel grows out of the button: the button sits inside it, filled white. -->
		<div class="panel" aria-hidden="true"></div>
	{/if}
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
		z-index: 60;
	}

	/* White fill on the button while open, so it reads as part of the black panel. */
	.toggle {
		position: relative;
		z-index: 2;
		transition: background 160ms ease-out, color 160ms ease-out;
	}

	.open .toggle {
		background: var(--color-text-dark);
		color: var(--color-text-light);
	}

	.panel {
		position: absolute;
		z-index: 1;
		top: -6px;
		right: -6px;
		width: 224px;
		height: calc(var(--layout-touch-min) + 12px + 2 * var(--layout-touch-min) + var(--space-3));
		border-radius: 28px;
		background: var(--color-text-light);
		box-shadow: 0 4px 12px rgb(0 0 0 / 0.25), 0 16px 40px rgb(0 0 0 / 0.28);
		transform-origin: top right;
		animation: grow 220ms cubic-bezier(0.2, 0.9, 0.3, 1);
	}

	.menu {
		position: absolute;
		z-index: 2;
		top: calc(var(--layout-touch-min) + 6px);
		right: -6px;
		width: 224px;
		display: flex;
		flex-direction: column;
		padding: 0 var(--space-2) var(--space-2);
		color: var(--color-text-dark);
		animation: items-in 220ms ease-out;
	}

	.menu a {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: var(--layout-touch-min);
		padding: 0 var(--space-4);
		border-radius: 16px;
		color: inherit;
		font-weight: 600;
		text-decoration: none;
	}

	.menu a:active,
	.menu a:focus-visible {
		background: rgb(255 255 255 / 0.14);
		outline: none;
	}

	@keyframes grow {
		from {
			opacity: 0.4;
			transform: scale(0.3);
		}
	}

	@keyframes items-in {
		from {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.panel,
		.menu {
			animation: none;
		}
		.toggle {
			transition: none;
		}
	}
</style>

<script lang="ts">
	// Inline stroke icons (DESIGN §8). Decorative: the button carries the label.
	type Name = 'search' | 'plus' | 'back' | 'close' | 'play' | 'next' | 'heart' | 'share' | 'link' | 'arrow';
	let { name, size = 20, filled = false }: { name: Name; size?: number; filled?: boolean } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 22 22"
	fill="none"
	stroke="currentColor"
	stroke-width="1.8"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#if name === 'search'}
		<circle cx="10" cy="10" r="6.5" /><path d="M15 15l4 4" />
	{:else if name === 'plus'}
		<path d="M11 4v14M4 11h14" />
	{:else if name === 'back'}
		<path d="M13.5 4.5L7 11l6.5 6.5" />
	{:else if name === 'close'}
		<path d="M5 5l12 12M17 5L5 17" />
	{:else if name === 'play'}
		<path d="M7 4.5l10 6.5-10 6.5z" fill="currentColor" stroke="none" />
	{:else if name === 'next'}
		<path d="M5 4l10 7-10 7z" /><path d="M18 4v14" />
	{:else if name === 'heart'}
		<path
			d="M11 18s-7-4.3-7-9.2A3.8 3.8 0 0 1 11 6.6a3.8 3.8 0 0 1 7 2.2C18 13.7 11 18 11 18z"
			fill={filled ? 'currentColor' : 'none'}
		/>
	{:else if name === 'share'}
		<path d="M13 5l5 5-5 5" /><path d="M18 10H10a5 5 0 0 0-5 5v2" />
	{:else if name === 'link'}
		<path d="M9 13l4-4" /><path d="M10 6.5l1.5-1.5a3.5 3.5 0 0 1 5 5L15 11.5" /><path
			d="M12 15.5L10.5 17a3.5 3.5 0 0 1-5-5L7 10.5"
		/>
	{:else if name === 'arrow'}
		<path d="M4 11h14M12 5l6 6-6 6" />
	{/if}
</svg>

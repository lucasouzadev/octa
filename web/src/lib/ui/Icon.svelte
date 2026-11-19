<script lang="ts">
	// Inline stroke icons (DESIGN §8). Decorative: the button carries the label.
	type Name = 'search' | 'plus' | 'back' | 'close' | 'play' | 'next' | 'heart' | 'share' | 'link' | 'arrow' | 'move' | 'minus' | 'up' | 'paste' | 'folder-plus' | 'send' | 'more' | 'edit' | 'trash' | 'check' | 'eye' | 'pause' | 'expand';
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
	{:else if name === 'pause'}
		<path d="M7 4.5v13M15 4.5v13" stroke-width="3" />
	{:else if name === 'expand'}
		<path d="M4 8V4h4M14 4h4v4M18 14v4h-4M8 18H4v-4" />
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
	{:else if name === 'move'}
		<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h6.5A1.5 1.5 0 0 1 19 8.5v7a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 3 15.5z" />
	{:else if name === 'folder-plus'}
		<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h6.5A1.5 1.5 0 0 1 19 8.5v7a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 3 15.5z" /><path d="M11 9.5v5M8.5 12h5" />
	{:else if name === 'minus'}
		<path d="M4 11h14" />
	{:else if name === 'up'}
		<path d="M11 18V4M5 10l6-6 6 6" />
	{:else if name === 'send'}
		<path d="M11 17V5M5.5 10.5L11 5l5.5 5.5" />
	{:else if name === 'paste'}
		<rect x="5" y="4.5" width="12" height="14" rx="2.5" /><path d="M8.5 4.5V4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v.5" /><path d="M8.5 10h5M8.5 13.5h3" />
	{:else if name === 'more'}
		<circle cx="5" cy="11" r="1.2" fill="currentColor" /><circle cx="11" cy="11" r="1.2" fill="currentColor" /><circle cx="17" cy="11" r="1.2" fill="currentColor" />
	{:else if name === 'edit'}
		<path d="M4 18l1-4 9-9 3 3-9 9z" /><path d="M12.5 6.5l3 3" />
	{:else if name === 'trash'}
		<path d="M4.5 6h13M9 6V4.5h4V6M6 6l.8 11a1.5 1.5 0 0 0 1.5 1.4h5.4a1.5 1.5 0 0 0 1.5-1.4L16 6" /><path d="M9.2 9.5v5M12.8 9.5v5" />
	{:else if name === 'check'}
		<path d="M4.5 11.5l4.5 4.5 8.5-9" />
	{:else if name === 'eye'}
		<path d="M2.5 11S6 5.5 11 5.5 19.5 11 19.5 11 16 16.5 11 16.5 2.5 11 2.5 11z" /><circle cx="11" cy="11" r="2.5" />
	{/if}
</svg>

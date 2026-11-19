<script lang="ts">
	// Line-art illustrations for empty states: one stroke, currentColor, no fills,
	// so they sit on the light Library and the dark Collection alike.
	let { kind, size = 168 }: { kind: 'library' | 'collection' | 'search'; size?: number } = $props();
</script>

<svg
	class="illustration"
	viewBox="0 0 200 140"
	width={size}
	height={(size * 140) / 200}
	fill="none"
	stroke="currentColor"
	stroke-width="2.5"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"
	data-kind={kind}
>
	{#if kind === 'library'}
		<!-- three tilted screens fanned out, the front one with a play triangle -->
		<rect x="22" y="46" width="76" height="54" rx="9" transform="rotate(-12 60 73)" />
		<rect x="102" y="46" width="76" height="54" rx="9" transform="rotate(12 140 73)" />
		<rect x="62" y="34" width="76" height="58" rx="9" />
		<path d="M92 52 L92 74 L110 63 Z" />
		<path d="M70 108 H130" />
	{:else if kind === 'collection'}
		<!-- an open folder holding a screen -->
		<path d="M30 40 H78 L90 54 H170 V108 H30 Z" />
		<rect x="58" y="30" width="84" height="56" rx="8" />
		<path d="M93 45 L93 66 L111 55.5 Z" />
		<path d="M30 74 H170" />
	{:else}
		<!-- a magnifier over a screen -->
		<rect x="36" y="36" width="92" height="64" rx="9" />
		<path d="M72 58 L72 78 L89 68 Z" />
		<circle cx="134" cy="84" r="22" />
		<path d="M150 100 L168 118" />
	{/if}
</svg>

<style>
	.illustration {
		display: block;
		max-width: 100%;
		opacity: 0.9;
	}
</style>

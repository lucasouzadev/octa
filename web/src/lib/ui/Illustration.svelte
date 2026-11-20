<script lang="ts">
	// Line-art illustrations for empty states: one stroke, currentColor, no fills,
	// so they sit on the light Library and the dark Collection alike.
	let { kind, size = 168 }: { kind: 'library' | 'collection' | 'search' | 'trash'; size?: number } = $props();
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
	<!-- One system: a 16:9 screen with a play mark. Each scene keeps every shape apart,
	     nothing crosses nothing, and a single idea carries the meaning. -->
	{#if kind === 'library'}
		<!-- A screen on a stand, waiting; a link floats beside it. -->
		<rect x="14" y="22" width="118" height="74" rx="10" />
		<path d="M62 44 V74 L88 59 Z" />
		<path d="M73 96 V112 M52 114 H94" />
		<!-- link: two capsules at an angle, joined -->
		<g transform="translate(166 58) rotate(-45)">
			<rect x="-22" y="-8" width="26" height="16" rx="8" />
			<rect x="-4" y="-8" width="26" height="16" rx="8" />
		</g>
		<path d="M166 22 V32 M186 30 L179 37 M146 30 L153 37" />
	{:else if kind === 'collection'}
		<!-- A folder, empty, with a dashed screen about to go in. -->
		<rect x="58" y="12" width="84" height="48" rx="8" stroke-dasharray="3 7" />
		<path d="M92 26 V46 L108 36 Z" stroke-dasharray="3 5" />
		<path d="M100 66 V74 M95 70 L100 75 L105 70" />
		<path d="M24 86 a8 8 0 0 1 8 -8 H70 l10 11 H168 a8 8 0 0 1 8 8 V120 a8 8 0 0 1 -8 8 H32 a8 8 0 0 1 -8 -8 Z" />
	{:else if kind === 'trash'}
		<!-- A hand lets go of a player; it drops into a trash can. Dashed line = the throw. -->
		<g transform="translate(-4 14) rotate(38 40 100)">
			<path d="M20 118 V62 a5 5 0 0 1 10 0 V82 H32 V54 a5 5 0 0 1 10 0 V82 H44 V58 a5 5 0 0 1 10 0 V82 H56 V68 a5 5 0 0 1 10 0 V102 Q66 118 52 118 Z" />
			<path d="M20 98 Q8 94 6 82 a4.5 4.5 0 0 1 9 -2 L22 92" />
		</g>
		<g transform="rotate(18 112 34)">
			<rect x="92" y="18" width="44" height="28" rx="6" />
			<path d="M108 25 V39 L120 32 Z" />
		</g>
		<path d="M82 62 Q90 44 90 30" stroke-dasharray="2 7" />
		<path d="M128 84 H184" />
		<path d="M146 84 V77 H166 V84" />
		<path d="M133 92 L138 130 H174 L179 92" />
		<path d="M150 100 V122 M156 100 V122 M162 100 V122" />
	{:else}
		<!-- A magnifying glass, a screen it did not find. -->
		<rect x="116" y="24" width="68" height="44" rx="8" />
		<path d="M142 36 V56 L158 46 Z" />
		<circle cx="62" cy="62" r="30" />
		<path d="M84 84 L112 112" />
		<path d="M52 62 H72" />
	{/if}
</svg>

<style>
	.illustration {
		display: block;
		max-width: 100%;
		opacity: 0.9;
	}
</style>

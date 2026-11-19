<script lang="ts">
	// WebGL renderer of the Library fan (DESIGN §6). Same composition as the CSS
	// fan, drawn on one on-demand canvas: it renders only when the tilt spring is
	// moving or a texture arrives, so an idle card costs nothing per frame.
	import { Canvas } from '@threlte/core';
	import FanScene from './FanScene.svelte';
	import type { FanItem } from '#lib/fan.ts';

	let {
		items,
		onready,
		onfail
	}: { items: FanItem[]; onready: () => void; onfail: () => void } = $props();
</script>

<Canvas renderMode="on-demand" dpr={Math.min(window.devicePixelRatio || 1, 2)}>
	<FanScene {items} {onready} {onfail} />
</Canvas>

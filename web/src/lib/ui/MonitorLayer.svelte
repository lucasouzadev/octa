<script lang="ts">
	// The one fixed WebGL canvas behind the Collection pile (DESIGN §6, slice 2e-3).
	import { Canvas } from '@threlte/core';
	import MonitorScene from './MonitorScene.svelte';

	let {
		list,
		heart,
		onready,
		onfail,
		onrowfail
	}: {
		list: HTMLElement;
		heart: boolean;
		onready: () => void;
		onfail: () => void;
		onrowfail: (id: string) => void;
	} = $props();
</script>

<div class="layer" aria-hidden="true">
	<Canvas renderMode="on-demand" dpr={Math.min(window.devicePixelRatio || 1, 2)}>
		<MonitorScene {list} {heart} {onready} {onfail} {onrowfail} />
	</Canvas>
</div>

<style>
	.layer {
		position: fixed;
		inset: 0;
		z-index: 0;
		pointer-events: none;
	}
</style>

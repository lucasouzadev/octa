<script lang="ts">
	import { disableTilt, enableTilt, tilt } from '#lib/tilt.svelte.ts';
	import Icon from '#lib/ui/Icon.svelte';

	// "Mover com o celular": the 3D objects lean with the phone like they follow a mouse on a
	// desktop. Only where the device has a sensor and touch. On iOS the tap below is also what
	// lets the system ask for permission.
	async function toggle() {
		if (tilt.enabled) disableTilt();
		else await enableTilt();
	}
</script>

{#if tilt.supported}
	<button
		class="icon-button"
		type="button"
		aria-label="Mover com o celular"
		aria-pressed={tilt.enabled}
		title={tilt.denied ? 'Sem permissão do sensor de movimento' : undefined}
		onclick={toggle}
	>
		<Icon name="tilt" />
	</button>
{/if}

<style>
	/* On: the same inverted disc the app uses for a pressed toggle. */
	button[aria-pressed='true'] {
		background: var(--color-text-light);
		color: var(--color-text-dark);
	}
</style>

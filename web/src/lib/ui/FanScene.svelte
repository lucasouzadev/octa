<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import {
		CanvasTexture,
		type MeshBasicMaterial,
		SRGBColorSpace,
		TextureLoader,
		type Texture
	} from 'three';
	import { onDestroy, onMount } from 'svelte';

	let {
		items,
		onready,
		onfail
	}: { items: { thumbnail?: string }[]; onready: () => void; onfail: () => void } = $props();

	const { invalidate, renderer } = useThrelte();

	// Scene units: the canvas is 16 wide and 10 tall; a paper is 34% x 92% of it,
	// so it lines up with the CSS fan underneath.
	const W = 16;
	const H = 10;
	const PW = W * 0.34;
	const PH = H * 0.92;
	const rad = (d: number) => (d * Math.PI) / 180;
	const TILT = 16;

	// [left, right, front] like the CSS fan: the newest video is in front.
	const sources = $derived([items[1], items[2], items[0]]);
	const slots = [
		{ x: -3.7, rotY: rad(TILT), rotZ: rad(7), z: 0 },
		{ x: 3.7, rotY: rad(-TILT), rotZ: rad(-7), z: 0 },
		{ x: 0, rotY: 0, rotZ: 0, z: 0.6 }
	];

	const owned: Texture[] = [];
	const own = (t: Texture) => (owned.push(t), t);

	function roundedAlpha(): Texture {
		const c = document.createElement('canvas');
		c.width = 512;
		c.height = Math.round(512 / (PW / PH));
		const g = c.getContext('2d')!;
		const r = 512 * (12 / 130); // radius-thumb 12px on a ~130px wide card
		g.fillStyle = '#fff';
		g.beginPath();
		g.roundRect(0, 0, c.width, c.height, r);
		g.fill();
		return own(new CanvasTexture(c));
	}

	function softShadow(): Texture {
		const c = document.createElement('canvas');
		c.width = 256;
		c.height = 64;
		const g = c.getContext('2d')!;
		const grad = g.createRadialGradient(128, 32, 4, 128, 32, 120);
		grad.addColorStop(0, 'rgba(0,0,0,0.28)');
		grad.addColorStop(1, 'rgba(0,0,0,0)');
		g.fillStyle = grad;
		g.fillRect(0, 0, 256, 64);
		return own(new CanvasTexture(c));
	}

	const alpha = roundedAlpha();
	const shadow = softShadow();
	let maps = $state<(Texture | null)[]>([null, null, null]);
	let materials = $state<(MeshBasicMaterial | undefined)[]>([undefined, undefined, undefined]);

	// three compiles a different shader once a map exists: flag the material, then draw.
	$effect(() => {
		maps.forEach((map, i) => {
			if (map && materials[i]) materials[i]!.needsUpdate = true;
		});
		invalidate();
	});

	const loader = new TextureLoader();
	loader.setCrossOrigin('anonymous'); // i.ytimg.com sends access-control-allow-origin: *

	function cover(tex: Texture) {
		// object-fit: cover for a portrait paper over a landscape (or any) image.
		const img = tex.image as { width: number; height: number };
		const paper = PW / PH;
		const pic = img.width / img.height;
		if (pic > paper) {
			tex.repeat.set(paper / pic, 1);
			tex.offset.set((1 - paper / pic) / 2, 0);
		} else {
			tex.repeat.set(1, pic / paper);
			tex.offset.set(0, (1 - pic / paper) / 2);
		}
	}

	let destroyed = false;
	onMount(async () => {
		const settled = sources.map(
			(item, i) =>
				new Promise<void>((resolve) => {
					if (!item?.thumbnail) return resolve();
					loader.load(
						item.thumbnail,
						(tex) => {
							if (destroyed) return tex.dispose();
							tex.colorSpace = SRGBColorSpace;
							cover(own(tex));
							maps[i] = tex;
							invalidate();
							resolve();
						},
						undefined,
						() => resolve() // a failed cover stays a grey paper
					);
				})
		);
		await Promise.all(settled);
		if (destroyed) return;
		invalidate();
		// Wait for the frame that draws the textures, then hand over from CSS.
		requestAnimationFrame(() => requestAnimationFrame(() => !destroyed && onready()));
	});

	// A lost context cannot be revived cheaply: give the CSS fan back for good.
	onMount(() => {
		const canvas = renderer.domElement;
		const lost = (e: Event) => (e.preventDefault(), onfail());
		canvas.addEventListener('webglcontextlost', lost);
		return () => canvas.removeEventListener('webglcontextlost', lost);
	});

	// Tilt: follows the pointer over the card with a spring (DESIGN §6).
	const STIFFNESS = 0.15;
	const DAMPING = 0.8;
	let target = { x: 0, y: 0 };
	let pos = $state({ x: 0, y: 0 });
	let vel = { x: 0, y: 0 };

	onMount(() => {
		const card = renderer.domElement.closest('a.card');
		if (!card) return;
		const move = (e: PointerEvent) => {
			const r = card.getBoundingClientRect();
			const next = {
				x: Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1)),
				y: Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1))
			};
			// Browsers repeat pointermove for a still mouse; redraw only when it really moved.
			if (Math.abs(next.x - target.x) < 0.01 && Math.abs(next.y - target.y) < 0.01) return;
			target = next;
			resting = false;
			invalidate();
		};
		const leave = () => {
			if (target.x === 0 && target.y === 0) return;
			target = { x: 0, y: 0 };
			resting = false;
			invalidate();
		};
		card.addEventListener('pointermove', move as EventListener);
		card.addEventListener('pointerleave', leave);
		card.addEventListener('pointercancel', leave);
		return () => {
			card.removeEventListener('pointermove', move as EventListener);
			card.removeEventListener('pointerleave', leave);
			card.removeEventListener('pointercancel', leave);
		};
	});

	// A task runs every frame, and writing `pos` redraws the scene. So once the spring
	// is close enough it snaps to its target and stops writing until the next move.
	let resting = true;

	useTask(
		() => {
			if (resting) return;
			for (const k of ['x', 'y'] as const) {
				vel[k] = (vel[k] + (target[k] - pos[k]) * STIFFNESS) * DAMPING;
				pos[k] += vel[k];
			}
			const moving =
				Math.abs(target.x - pos.x) > 0.002 ||
				Math.abs(target.y - pos.y) > 0.002 ||
				Math.abs(vel.x) > 0.002 ||
				Math.abs(vel.y) > 0.002;
			if (moving) return invalidate();
			pos.x = target.x;
			pos.y = target.y;
			vel = { x: 0, y: 0 };
			resting = true;
		},
		{ autoInvalidate: false } // else this task would redraw every frame, forever
	);

	onDestroy(() => {
		destroyed = true;
		for (const t of owned) t.dispose();
	});
</script>

<T.PerspectiveCamera
	makeDefault
	fov={30}
	position={[0, 0, 5 / Math.tan(rad(15))]}
	oncreate={(ref) => ref.lookAt(0, 0, 0)}
/>

<T.Group rotation.x={pos.y * -0.18} rotation.y={pos.x * 0.28}>
	<T.Mesh position={[0, -H * 0.4, -1]}>
		<T.PlaneGeometry args={[W * 0.72, H * 0.22]} />
		<T.MeshBasicMaterial map={shadow} transparent depthWrite={false} toneMapped={false} />
	</T.Mesh>

	{#each slots as s, i (i)}
		<T.Mesh position={[s.x, 0, s.z]} rotation={[0, s.rotY, s.rotZ]}>
			<T.PlaneGeometry args={[PW, PH]} />
			<T.MeshBasicMaterial
				bind:ref={materials[i]}
				map={maps[i]}
				color={maps[i] ? '#ffffff' : '#dcdcdc'}
				alphaMap={alpha}
				transparent
				toneMapped={false}
			/>
		</T.Mesh>
	{/each}
</T.Group>

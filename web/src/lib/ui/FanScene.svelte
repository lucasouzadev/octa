<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { CanvasTexture, SRGBColorSpace } from 'three';
	import { onDestroy, onMount } from 'svelte';
	import { cardLabel, fanCards, type FanItem } from '#lib/fan.ts';

	let {
		items,
		onready,
		onfail
	}: { items: FanItem[]; onready: () => void; onfail: () => void } = $props();

	const { invalidate, renderer } = useThrelte();

	// Scene units: the canvas is 16 wide and 8.5 tall, the same 16:8.5 box as the CSS
	// fan, so every card lines up with the composition it replaces (prototype page 2).
	const W = 16;
	const H = 8.5;
	const rad = (d: number) => (d * Math.PI) / 180;
	const PAD = 0.24; // extra room around a card for its drop shadow
	const PX = 130; // canvas pixels per scene unit

	// Card sizes in scene units (including the white border), as in the CSS tiles.
	const sizeOf = (vertical: boolean) => {
		const w = vertical ? 0.22 * W : 0.3 * W;
		return { w, h: vertical ? (w * 13) / 9 : (w * 3) / 4 };
	};

	const cards = $derived(fanCards(items));

	interface Face {
		canvas: HTMLCanvasElement;
		texture: CanvasTexture;
		w: number;
		h: number;
	}

	let faces = $state<Face[]>([]);
	let fontsReady = false;

	function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
		g.beginPath();
		g.roundRect(x, y, w, h, r);
	}

	// One 2D canvas per card: shadow, white border, thumbnail (object-fit: cover),
	// bottom band and the uppercase source label. It becomes the card's texture, so
	// the material never changes and three never has to recompile it.
	function paint(face: Face, item: FanItem | null, image: HTMLImageElement | null) {
		const { canvas, w, h } = face;
		const g = canvas.getContext('2d')!;
		const cw = w * PX;
		const ch = h * PX;
		const ox = (canvas.width - cw) / 2;
		const oy = (canvas.height - ch) / 2;
		const radius = cw * 0.157;
		const border = cw * 0.015;
		g.clearRect(0, 0, canvas.width, canvas.height);

		g.save();
		g.shadowColor = 'rgba(0,0,0,0.16)';
		g.shadowBlur = cw * 0.18;
		g.shadowOffsetX = cw * 0.09;
		g.shadowOffsetY = -cw * 0.07;
		g.fillStyle = '#fff';
		roundRect(g, ox, oy, cw, ch, radius);
		g.fill();
		g.restore();

		const ix = ox + border;
		const iy = oy + border;
		const iw = cw - border * 2;
		const ih = ch - border * 2;
		g.save();
		roundRect(g, ix, iy, iw, ih, radius - border);
		g.clip();
		g.fillStyle = item ? '#cfcfcf' : '#e2e2e2';
		g.fillRect(ix, iy, iw, ih);
		if (image && image.naturalWidth > 0) {
			const scale = Math.max(iw / image.naturalWidth, ih / image.naturalHeight);
			const dw = image.naturalWidth * scale;
			const dh = image.naturalHeight * scale;
			g.drawImage(image, ix + (iw - dw) / 2, iy + (ih - dh) / 2, dw, dh);
		}
		if (item) {
			const band = g.createLinearGradient(0, iy + ih, 0, iy + ih - cw * 0.3);
			band.addColorStop(0, 'rgba(0,0,0,0.5)');
			band.addColorStop(1, 'rgba(0,0,0,0)');
			g.fillStyle = band;
			g.fillRect(ix, iy + ih - cw * 0.3, iw, cw * 0.3);
			g.fillStyle = '#fff';
			g.font = `600 ${cw * 0.112}px "Inter Variable", Inter, system-ui, sans-serif`;
			g.textBaseline = 'alphabetic';
			(g as unknown as { letterSpacing: string }).letterSpacing = `${cw * 0.009}px`;
			g.fillText(cardLabel(item).toUpperCase(), ix + cw * 0.09, iy + ih - cw * 0.07);
		}
		g.restore();
		face.texture.needsUpdate = true;
	}

	let destroyed = false;

	function load(url: string): Promise<HTMLImageElement | null> {
		return new Promise((resolve) => {
			const img = new Image();
			img.crossOrigin = 'anonymous'; // i.ytimg.com sends access-control-allow-origin: *
			img.onload = () => resolve(img);
			img.onerror = () => resolve(null); // a failed cover stays a grey card
			img.src = url;
		});
	}

	onMount(async () => {
		try {
			await document.fonts.load('600 12px "Inter Variable"');
		} catch {
			// the label falls back to the system font
		}
		fontsReady = true;
		if (destroyed) return;

		faces = cards.map((c) => {
			const { w, h } = sizeOf(c.vertical);
			const canvas = document.createElement('canvas');
			canvas.width = Math.round(w * (1 + PAD * 2) * PX);
			canvas.height = Math.round(h * (1 + PAD * 2) * PX);
			const texture = new CanvasTexture(canvas);
			texture.colorSpace = SRGBColorSpace;
			return { canvas, texture, w, h };
		});
		faces.forEach((f, i) => paint(f, cards[i].item, null));
		invalidate();

		await Promise.all(
			cards.map(async (c, i) => {
				if (!c.item?.thumbnail) return;
				const image = await load(c.item.thumbnail);
				if (destroyed || !image) return;
				paint(faces[i], c.item, image);
				invalidate();
			})
		);
		if (destroyed) return;
		invalidate();
		// Wait for the frame that draws the cards, then hand over from CSS.
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
		for (const f of faces) f.texture.dispose();
	});

	void fontsReady;
</script>

<T.PerspectiveCamera
	makeDefault
	fov={30}
	position={[0, 0, H / 2 / Math.tan(rad(15))]}
	oncreate={(ref) => ref.lookAt(0, 0, 0)}
/>

<T.Group rotation.x={pos.y * -0.12} rotation.y={pos.x * 0.2}>
	{#each cards as c, i (i)}
		{#if faces[i]}
			<T.Mesh
				position={[(c.x / 100) * W, -(c.drop / 100) * H, (c.z - 90) * 0.03]}
				rotation={[0, rad(-c.rotZ * 1.2), rad(-c.rotZ)]}
			>
				<T.PlaneGeometry args={[faces[i].w * (1 + PAD * 2), faces[i].h * (1 + PAD * 2)]} />
				<T.MeshBasicMaterial map={faces[i].texture} transparent toneMapped={false} />
			</T.Mesh>
		{/if}
	{/each}
</T.Group>

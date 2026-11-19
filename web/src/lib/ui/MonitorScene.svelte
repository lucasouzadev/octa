<script lang="ts">
	// WebGL monitors for the Collection screen (slice 2e-3). One canvas, fixed over the
	// viewport, draws every monitor near the screen. The DOM rows stay (link, text,
	// focus); this only replaces how they look. Camera units are CSS px, so a monitor
	// at rest lands exactly on its row. Tilt: base pose + scroll position + the mouse.
	import { T, useThrelte } from '@threlte/core';
	import { CanvasTexture, ExtrudeGeometry, Shape, SRGBColorSpace } from 'three';
	import { onDestroy, onMount } from 'svelte';
	import { monitorPose, stepSpring, visibleIndexes, type Spring } from '#lib/monitor.ts';
	import { measure, paintFace, paintHeart, paintShadow, type Measured } from './monitorPaint.ts';

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

	const { invalidate, renderer } = useThrelte();
	const rad = (d: number) => (d * Math.PI) / 180;
	const DEPTH = 12; // thickness of the body, in px
	const BEVEL = 2;
	const PAD = 60; // room around a monitor for its shadow
	const MARGIN = 400; // draw rows this far outside the viewport, so they are ready as they scroll in
	const SCALE = Math.min(window.devicePixelRatio || 1, 2);
	const FOV = 30;

	interface Mon {
		id: string;
		index: number;
		m: Measured;
		face: CanvasTexture;
		faceCanvas: HTMLCanvasElement;
		shadow: CanvasTexture;
		heart: CanvasTexture | null;
		body: ExtrudeGeometry;
		image: HTMLImageElement | null;
	}

	let vw = $state(window.innerWidth);
	let vh = $state(window.innerHeight);
	let mons = $state<Mon[]>([]);
	// Row geometry now, in viewport px (re-read on scroll and resize).
	let rects = $state<Record<string, { cx: number; cy: number; top: number; height: number }>>({});
	let destroyed = false;
	let ready = false;
	const cameraZ = $derived(vh / 2 / Math.tan(rad(FOV / 2)));

	const rows = () => [...list.querySelectorAll<HTMLLIElement>(':scope > li')];

	function bodyGeometry(w: number, h: number, r: number): ExtrudeGeometry {
		const hw = w / 2 - BEVEL;
		const hh = h / 2 - BEVEL;
		const rr = Math.max(1, r - BEVEL);
		const s = new Shape();
		s.moveTo(-hw + rr, -hh);
		s.lineTo(hw - rr, -hh);
		s.absarc(hw - rr, -hh + rr, rr, -Math.PI / 2, 0, false);
		s.lineTo(hw, hh - rr);
		s.absarc(hw - rr, hh - rr, rr, 0, Math.PI / 2, false);
		s.lineTo(-hw + rr, hh);
		s.absarc(-hw + rr, hh - rr, rr, Math.PI / 2, Math.PI, false);
		s.lineTo(-hw, -hh + rr);
		s.absarc(-hw + rr, -hh + rr, rr, Math.PI, Math.PI * 1.5, false);
		return new ExtrudeGeometry(s, {
			depth: DEPTH,
			bevelEnabled: true,
			bevelThickness: BEVEL,
			bevelSize: BEVEL,
			bevelSegments: 2,
			curveSegments: 10
		});
	}

	function texture(canvas: HTMLCanvasElement): CanvasTexture {
		const t = new CanvasTexture(canvas);
		t.colorSpace = SRGBColorSpace;
		return t;
	}

	function load(url: string): Promise<HTMLImageElement | null> {
		return new Promise((resolve) => {
			const img = new Image();
			img.crossOrigin = 'anonymous'; // without CORS the canvas would taint WebGL
			img.onload = () => resolve(img);
			img.onerror = () => resolve(null);
			img.src = url;
		});
	}

	function build(li: HTMLLIElement, index: number): Mon | null {
		const row = li.querySelector<HTMLElement>('a.screen');
		if (!row) return null;
		const m = measure(row);
		if (!m || m.w === 0) return null;
		const faceCanvas = document.createElement('canvas');
		faceCanvas.width = Math.round(m.w * SCALE);
		faceCanvas.height = Math.round(m.h * SCALE);
		paintFace(faceCanvas, m, null, SCALE);
		const sc = document.createElement('canvas');
		const ss = 0.5;
		sc.width = Math.round((m.w + PAD * 2) * ss);
		sc.height = Math.round((m.h + PAD * 2) * ss);
		paintShadow(sc, m.w, m.h, m.radius, PAD, ss);
		let heartTex: CanvasTexture | null = null;
		if (heart) {
			const hc = document.createElement('canvas');
			hc.width = hc.height = Math.round(40 * SCALE);
			paintHeart(hc, 40, getComputedStyle(row.querySelector('.heart') ?? row).backgroundColor, SCALE);
			heartTex = texture(hc);
		}
		const mon: Mon = {
			id: li.dataset.id ?? String(index),
			index,
			m,
			face: texture(faceCanvas),
			faceCanvas,
			shadow: texture(sc),
			heart: heartTex,
			body: bodyGeometry(m.w, m.h, m.radius),
			image: null
		};
		const src = row.querySelector<HTMLImageElement>('.thumb img')?.currentSrc || row.querySelector<HTMLImageElement>('.thumb img')?.src;
		if (src) {
			load(src).then((img) => {
				if (destroyed) return;
				if (!img) return onrowfail(mon.id); // cover host without CORS: this row keeps the CSS monitor
				mon.image = img;
				paintFace(mon.faceCanvas, mon.m, img, SCALE);
				mon.face.needsUpdate = true;
				invalidate();
			});
		}
		return mon;
	}

	function dispose(mon: Mon) {
		mon.face.dispose();
		mon.shadow.dispose();
		mon.heart?.dispose();
		mon.body.dispose();
	}

	// Which monitors exist: those near the viewport. Built on demand, freed when far away.
	function sync() {
		const lis = rows();
		const next: Record<string, { cx: number; cy: number; top: number; height: number }> = {};
		const boxes = lis.map((li) => li.getBoundingClientRect());
		lis.forEach((li, i) => {
			const b = boxes[i];
			next[li.dataset.id ?? String(i)] = { cx: b.left + b.width / 2, cy: b.top + b.height / 2, top: b.top, height: b.height };
		});
		rects = next;
		const wanted = new Set(visibleIndexes(boxes, vh, MARGIN));
		const keep: Mon[] = [];
		for (const mon of mons) {
			if (wanted.has(mon.index) && lis[mon.index]?.dataset.id === mon.id) keep.push(mon);
			else dispose(mon);
		}
		const have = new Set(keep.map((k) => k.index));
		for (const i of wanted) {
			if (have.has(i)) continue;
			const built = build(lis[i], i);
			if (built) keep.push(built);
		}
		keep.sort((a, b) => a.index - b.index);
		mons = keep;
		invalidate();
	}

	let frame = 0;
	function schedule() {
		if (frame) return;
		frame = requestAnimationFrame(() => {
			frame = 0;
			if (destroyed) return;
			vw = window.innerWidth;
			vh = window.innerHeight;
			sync();
		});
	}

	onMount(async () => {
		try {
			await document.fonts.ready;
		} catch {
			// system font fallback
		}
		if (destroyed) return;
		sync();
		window.addEventListener('scroll', schedule, { passive: true });
		window.addEventListener('resize', schedule);
		const lost = (e: Event) => (e.preventDefault(), onfail());
		renderer.domElement.addEventListener('webglcontextlost', lost);
		const mo = new MutationObserver(schedule); // rows added, removed or reordered
		mo.observe(list, { childList: true });
		cleanup = () => {
			window.removeEventListener('scroll', schedule);
			window.removeEventListener('resize', schedule);
			renderer.domElement.removeEventListener('webglcontextlost', lost);
			mo.disconnect();
		};
		// Hand over from CSS once a frame with the monitors has been drawn.
		requestAnimationFrame(() => requestAnimationFrame(() => !destroyed && !ready && ((ready = true), onready())));
	});

	let cleanup = () => {};
	onDestroy(() => {
		destroyed = true;
		cancelAnimationFrame(frame);
		cleanup();
		mons.forEach(dispose);
	});

	// Mouse tilt: the monitor under the pointer follows it with a spring and lifts a little.
	// Touch has no hover, so on a phone the tilt comes from scrolling alone.
	type Hover = { x: Spring; y: Spring; lift: Spring };
	const hovers = new Map<string, Hover>();
	let pointer: { id: string; x: number; y: number } | null = null;
	let anim = 0;

	function tick() {
		anim = 0;
		let moving = false;
		for (const [id, h] of hovers) {
			const on = pointer?.id === id;
			h.x = stepSpring(h.x, on ? pointer!.x : 0);
			h.y = stepSpring(h.y, on ? pointer!.y : 0);
			h.lift = stepSpring(h.lift, on ? 1 : 0);
			if (h.x.vel || h.y.vel || h.lift.vel || (!on && (h.x.pos || h.y.pos || h.lift.pos))) moving = true;
			if (!on && !h.x.pos && !h.y.pos && !h.lift.pos) hovers.delete(id);
		}
		hover = new Map(hovers);
		invalidate();
		if (moving) anim = requestAnimationFrame(tick);
	}
	let hover = $state(new Map<string, Hover>());

	onMount(() => {
		const move = (e: PointerEvent) => {
			if (e.pointerType !== 'mouse') return;
			let hit: { id: string; x: number; y: number } | null = null;
			for (const [id, r] of Object.entries(rects)) {
				const el = list.querySelector<HTMLElement>(`:scope > li[data-id="${CSS.escape(id)}"]`);
				const w = el?.offsetWidth ?? 0;
				if (Math.abs(e.clientX - r.cx) <= w / 2 && Math.abs(e.clientY - r.cy) <= r.height / 2) {
					// Later monitors sit in front, so the last hit wins.
					hit = { id, x: ((e.clientX - r.cx) / (w / 2)), y: ((e.clientY - r.cy) / (r.height / 2)) };
				}
			}
			pointer = hit;
			if (hit && !hovers.has(hit.id)) hovers.set(hit.id, { x: { pos: 0, vel: 0 }, y: { pos: 0, vel: 0 }, lift: { pos: 0, vel: 0 } });
			if (!anim) anim = requestAnimationFrame(tick);
		};
		const leave = () => {
			pointer = null;
			if (!anim) anim = requestAnimationFrame(tick);
		};
		window.addEventListener('pointermove', move);
		document.addEventListener('pointerleave', leave);
		return () => {
			window.removeEventListener('pointermove', move);
			document.removeEventListener('pointerleave', leave);
			cancelAnimationFrame(anim);
		};
	});

	// Camera units are CSS px: the plane z = 0 projects 1:1 onto the page.
	const place = (id: string, mon: Mon) => {
		const r = rects[id];
		if (!r) return null;
		const h = hover.get(id);
		const pose = monitorPose(mon.index, r.cy, vh, { x: h?.x.pos ?? 0, y: h?.y.pos ?? 0 });
		return { x: r.cx - vw / 2, y: vh / 2 - r.cy, z: 28 * (h?.lift.pos ?? 0), pose };
	};
</script>

<T.PerspectiveCamera makeDefault fov={FOV} position={[0, 0, cameraZ]} near={10} far={cameraZ * 3} oncreate={(ref) => ref.lookAt(0, 0, 0)} />
<T.AmbientLight intensity={1.15} />
<T.DirectionalLight position={[-300, 500, 800]} intensity={1.7} />

{#each mons as mon (mon.id)}
	{@const p = place(mon.id, mon)}
	{#if p}
		<T.Group position={[p.x, p.y, p.z]} rotation={[p.pose.rotX, p.pose.rotY, p.pose.rotZ]}>
			<!-- shadow: further back, offset like the CSS cast shadow -->
			<T.Mesh position={[10, -16, -DEPTH - 2]} renderOrder={mon.index * 10}>
				<T.PlaneGeometry args={[mon.m.w + PAD * 2, mon.m.h + PAD * 2]} />
				<T.MeshBasicMaterial map={mon.shadow} transparent depthTest={false} depthWrite={false} toneMapped={false} />
			</T.Mesh>
			<!-- body: the thickness, front face at z = 0 and the back at -DEPTH. Convex, so
			     with back faces culled and no depth test it draws correctly in painter order. -->
			<T.Mesh geometry={mon.body} position={[0, 0, -DEPTH]} renderOrder={mon.index * 10 + 1}>
				<T.MeshStandardMaterial color="#d9d5cb" roughness={0.85} metalness={0} depthTest={false} depthWrite={false} />
			</T.Mesh>
			<!-- face: the painted bezel, screen, play button and text -->
			<T.Mesh position={[0, 0, BEVEL + 0.2]} renderOrder={mon.index * 10 + 2}>
				<T.PlaneGeometry args={[mon.m.w, mon.m.h]} />
				<T.MeshBasicMaterial map={mon.face} transparent depthTest={false} depthWrite={false} toneMapped={false} />
			</T.Mesh>
			{#if mon.heart}
				<T.Mesh position={[mon.m.w / 2 - 14, mon.m.h / 2 - 10, 36]} rotation.z={rad(-12)} renderOrder={mon.index * 10 + 3}>
					<T.PlaneGeometry args={[40, 40]} />
					<T.MeshBasicMaterial map={mon.heart} transparent depthTest={false} depthWrite={false} toneMapped={false} />
				</T.Mesh>
			{/if}
		</T.Group>
	{/if}
{/each}

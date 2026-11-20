// 2D painting of one WebGL monitor's face (slice 2e-3). The face is measured from the
// live DOM row (`a.screen`), so the pixels sit exactly where the CSS monitor puts
// them and the two renderers cannot drift apart. Offsets use offsetLeft/offsetTop,
// which ignore CSS transforms.

export interface Box {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface Measured {
	w: number;
	h: number;
	radius: number;
	bezel: number;
	thumb: Box;
	thumbRadius: number;
	meta: Box;
	src: string;
	dur: string;
	status: { text: string; dead: boolean } | null;
	seen: boolean;
	name: Box;
	title: string;
	titleFont: string;
	titleLine: number;
	titleColor: string;
	metaFont: string;
	metaColor: string;
	deadColor: string;
	paper: string;
	dead: boolean;
}

function boxIn(el: HTMLElement, root: HTMLElement): Box {
	let x = 0;
	let y = 0;
	let node: HTMLElement | null = el;
	while (node && node !== root) {
		x += node.offsetLeft;
		y += node.offsetTop;
		node = node.offsetParent as HTMLElement | null;
	}
	return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

/** Read everything the painter needs from one `a.screen`. Call with no CSS tilt in the way. */
export function measure(row: HTMLElement): Measured | null {
	const thumb = row.querySelector<HTMLElement>('.thumb');
	const meta = row.querySelector<HTMLElement>('.meta');
	const name = row.querySelector<HTMLElement>('.name');
	if (!thumb || !meta || !name) return null;
	const cs = getComputedStyle(row);
	const ns = getComputedStyle(name);
	const ms = getComputedStyle(meta);
	const status = meta.querySelector<HTMLElement>('.status:not(.seen)');
	const dead = row.classList.contains('dead');
	const deadEl = row.querySelector<HTMLElement>('.status.dead');
	const bezel = parseFloat(cs.paddingLeft) || 10;
	return {
		w: row.offsetWidth,
		h: row.offsetHeight,
		radius: parseFloat(cs.borderTopLeftRadius) || 18,
		bezel,
		thumb: boxIn(thumb, row),
		thumbRadius: parseFloat(getComputedStyle(thumb).borderTopLeftRadius) || 12,
		meta: boxIn(meta, row),
		src: row.querySelector('.src')?.textContent?.trim() ?? '',
		dur: row.querySelector('.dur')?.textContent?.trim() ?? '',
		status: status ? { text: status.textContent?.trim() ?? '', dead } : null,
		seen: !!row.querySelector('.status.seen'),
		name: boxIn(name, row),
		title: name.textContent?.trim() ?? '',
		titleFont: `${ns.fontStyle} ${ns.fontWeight} ${ns.fontSize} ${ns.fontFamily}`,
		titleLine: parseFloat(ns.lineHeight) || parseFloat(ns.fontSize) * 1.15,
		titleColor: ns.color,
		metaFont: `${ms.fontWeight} ${ms.fontSize} ${ms.fontFamily}`,
		metaColor: ms.color,
		deadColor: deadEl ? getComputedStyle(deadEl).color : '#c0392b',
		paper: cs.backgroundColor,
		dead
	};
}

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	g.beginPath();
	g.roundRect(x, y, w, h, r);
}

/** Greedy wrap to `max` px, at most `lines` lines, the last one ending in an ellipsis. */
export function wrap(g: CanvasRenderingContext2D, text: string, max: number, lines: number): string[] {
	const words = text.split(/\s+/).filter(Boolean);
	const out: string[] = [];
	let line = '';
	for (let i = 0; i < words.length; i++) {
		const next = line ? `${line} ${words[i]}` : words[i];
		if (g.measureText(next).width <= max || !line) {
			line = next;
			continue;
		}
		out.push(line);
		line = words[i];
		if (out.length === lines - 1) {
			line = words.slice(i).join(' ');
			break;
		}
	}
	if (line) out.push(line);
	if (out.length > lines) out.length = lines;
	const last = out.length - 1;
	if (last >= 0 && out[last] && g.measureText(out[last]).width > max) {
		let t = out[last];
		while (t.length > 1 && g.measureText(`${t}…`).width > max) t = t.slice(0, -1);
		out[last] = `${t}…`;
	}
	return out;
}

/** Paint the monitor face at `scale` canvas px per CSS px. `image` is the cover, if loaded. */
export function paintFace(canvas: HTMLCanvasElement, m: Measured, image: HTMLImageElement | null, scale: number) {
	const g = canvas.getContext('2d')!;
	g.setTransform(scale, 0, 0, scale, 0, 0);
	g.clearRect(0, 0, m.w, m.h);

	// Bezel: the cream paper (the extruded body shows through at the edges and sides).
	g.fillStyle = m.paper;
	rr(g, 0, 0, m.w, m.h, m.radius);
	g.fill();

	// Screen: dark placeholder, then the cover (object-fit: cover).
	const t = m.thumb;
	g.save();
	rr(g, t.x, t.y, t.w, t.h, m.thumbRadius);
	g.clip();
	const grad = g.createLinearGradient(0, t.y, 0, t.y + t.h);
	grad.addColorStop(0.62, '#3a3631');
	grad.addColorStop(0.62, '#4a453f');
	grad.addColorStop(1, '#4a453f');
	g.fillStyle = grad;
	g.fillRect(t.x, t.y, t.w, t.h);
	if (image && image.naturalWidth > 0) {
		const s = Math.max(t.w / image.naturalWidth, t.h / image.naturalHeight);
		const dw = image.naturalWidth * s;
		const dh = image.naturalHeight * s;
		g.drawImage(image, t.x + (t.w - dw) / 2, t.y + (t.h - dh) / 2, dw, dh);
		if (m.dead) {
			g.globalCompositeOperation = 'saturation';
			g.fillStyle = '#808080';
			g.fillRect(t.x, t.y, t.w, t.h);
			g.globalCompositeOperation = 'multiply';
			g.fillStyle = '#d9d9d9';
			g.fillRect(t.x, t.y, t.w, t.h);
			g.globalCompositeOperation = 'source-over';
		}
	}
	g.restore();

	// Meta line: SOURCE · length on the left, status on the right.
	g.font = m.metaFont;
	g.textBaseline = 'alphabetic';
	const ls = g as unknown as { letterSpacing: string };
	ls.letterSpacing = '0.08em';
	const baseline = m.meta.y + m.meta.h * 0.5 + parseFloat(m.metaFont.split(' ')[1] ?? '11') * 0.36;
	g.fillStyle = m.metaColor;
	const left = [m.src.toUpperCase(), m.dur ? `· ${m.dur}` : ''].filter(Boolean).join(' ');
	g.fillText(left, m.meta.x + 8, baseline);
	const right = m.status?.text ?? (m.seen ? 'ASSISTIDO' : '');
	if (right) {
		g.textAlign = 'right';
		g.fillStyle = m.status?.dead ? m.deadColor : m.metaColor;
		g.fillText(right.toUpperCase(), m.meta.x + m.meta.w - 8, baseline);
		g.textAlign = 'left';
	}

	// Title in the display serif, two lines at most.
	ls.letterSpacing = '-0.01em';
	g.font = m.titleFont;
	g.fillStyle = m.titleColor;
	const lines = wrap(g, m.title, m.name.w - 16, 2);
	lines.forEach((line, i) => g.fillText(line, m.name.x + 8, m.name.y + m.titleLine * (i + 0.8)));
	ls.letterSpacing = '0px';
}

/** A soft drop shadow, painted once per monitor at low resolution (it is blurred anyway). */
export function paintShadow(canvas: HTMLCanvasElement, w: number, h: number, radius: number, pad: number, scale: number) {
	const g = canvas.getContext('2d')!;
	g.setTransform(scale, 0, 0, scale, 0, 0);
	g.clearRect(0, 0, w + pad * 2, h + pad * 2);
	g.shadowColor = 'rgba(0,0,0,0.6)';
	g.shadowBlur = 26 * scale;
	g.fillStyle = '#000';
	rr(g, pad, pad, w, h, radius);
	g.fill();
}

/** The Favoritos heart badge: orange disc with a white heart. */
export function paintHeart(canvas: HTMLCanvasElement, size: number, color: string, scale: number, glyph = '#ffffff') {
	const g = canvas.getContext('2d')!;
	g.setTransform(scale, 0, 0, scale, 0, 0);
	g.clearRect(0, 0, size, size);
	g.fillStyle = color;
	g.beginPath();
	g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
	g.fill();
	g.save();
	g.translate(size / 2 - 11, size / 2 - 10.5);
	g.scale(22 / 24, 22 / 24);
	g.fillStyle = glyph;
	g.fill(new Path2D('M12 21s-7-4.6-9.3-9.2C1.4 8.5 3.4 5 6.8 5c1.9 0 3.4 1 5.2 3 1.8-2 3.3-3 5.2-3 3.4 0 5.4 3.5 4.1 6.8C19 16.4 12 21 12 21z'));
	g.restore();
}

// One WebGL canvas at a time (DESIGN §6). Every fan reports whether it is on
// screen; only the first visible one (in card order) may run WebGL, the others
// keep the CSS-3D composition.
let visible = $state<Record<string, number>>({});

export function setVisible(id: string, order: number, on: boolean): void {
	if (on) visible[id] = order;
	else delete visible[id];
}

export function isActive(id: string): boolean {
	const entries = Object.entries(visible);
	if (entries.length === 0) return false;
	const first = entries.reduce((a, b) => (b[1] < a[1] ? b : a));
	return first[0] === id;
}

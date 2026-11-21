// Which color each screen paints, so the browser chrome (status bar, bottom bar) can
// take it too. One color per screen, edge to edge: no white strips on blue or black.
const BLUE = '#1A3CFF'; // color.action.create
const WHITE = '#FFFFFF'; // color.bg.light
const BLACK = '#000000'; // color.bg.dark
const GREEN = '#2F6B4F'; // color.action.favorite (matte)

/**
 * `routeId` is SvelteKit's route pattern, e.g. "/c/[id]"; `scope` is that route's `id` param
 * (which collection). Unknown routes are dark; Favoritos is the one green collection.
 */
export function themeColorFor(routeId: string | null | undefined, scope?: string | null): string {
	switch (routeId) {
		case '/c/[id]':
			return scope === 'favoritos' ? GREEN : BLACK;
		case '/add':
		case '/c/new':
			return BLUE;
		case '/':
			return WHITE;
		default:
			return BLACK;
	}
}

/**
 * A light screen under a translucent status bar needs a dark strip behind the clock: that bar
 * always draws white text. Anything that is not a plain #RRGGBB counts as dark.
 */
export function isLightColor(hex: string): boolean {
	const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
	if (!m) return false;
	const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.8;
}

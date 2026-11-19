// Which color each screen paints, so the browser chrome (status bar, bottom bar) can
// take it too. One color per screen, edge to edge: no white strips on blue or black.
const BLUE = '#1A3CFF'; // color.action.create
const WHITE = '#FFFFFF'; // color.bg.light
const BLACK = '#000000'; // color.bg.dark

/** `routeId` is SvelteKit's route pattern, e.g. "/c/[id]". Unknown routes are dark. */
export function themeColorFor(routeId: string | null | undefined): string {
	switch (routeId) {
		case '/add':
		case '/c/new':
			return BLUE;
		case '/':
			return WHITE;
		default:
			return BLACK;
	}
}

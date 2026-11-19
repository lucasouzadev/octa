// How much of the bottom of the page the on-screen keyboard covers. The page itself
// never moves: a bar fixed to the bottom lifts by this much instead.
export interface VisualViewportLike {
	height: number;
	offsetTop: number;
}

export function keyboardInset(vv: VisualViewportLike, innerHeight: number): number {
	return Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop));
}

export interface VisualViewportFrameLike extends VisualViewportLike {
	width: number;
	offsetLeft: number;
}

/** The visible window in layout (position: fixed) coordinates. */
export function visualFrame(vv: VisualViewportFrameLike) {
	const top = Math.round(vv.offsetTop);
	const height = Math.round(vv.height);
	return {
		top,
		left: Math.round(vv.offsetLeft),
		width: Math.round(vv.width),
		height,
		bottom: top + height
	};
}

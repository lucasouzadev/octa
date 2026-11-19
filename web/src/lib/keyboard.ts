// How much of the bottom of the page the on-screen keyboard covers. The page itself
// never moves: a bar fixed to the bottom lifts by this much instead.
export interface VisualViewportLike {
	height: number;
	offsetTop: number;
}

export function keyboardInset(vv: VisualViewportLike, innerHeight: number): number {
	return Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop));
}

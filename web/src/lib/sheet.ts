// Gesture rules shared by every bottom sheet. The drag follows the finger down, resists
// going up (rubber band) and closes on distance or on a quick flick.

const STRETCH = 56; // the most a sheet may be pulled up, in px
const FLICK_SPEED = 0.6; // px per ms
const FLICK_MIN = 24; // a twitch shorter than this is not a flick
const CLOSE_RATIO = 1 / 3;

/** Translate for a finger that moved `dy` px from where it landed (down is positive). */
export function dragOffset(dy: number): number {
	if (dy >= 0) return dy;
	// Asymptotic: gets harder the further it goes, never beyond STRETCH.
	return -STRETCH * (1 - 1 / (1 + -dy / STRETCH));
}

/** Decide on release. `velocity` is px/ms, positive when moving down. */
export function shouldDismiss(offset: number, height: number, velocity: number): boolean {
	if (offset <= 0) return false;
	if (offset >= height * CLOSE_RATIO) return true;
	return velocity >= FLICK_SPEED && offset >= FLICK_MIN;
}

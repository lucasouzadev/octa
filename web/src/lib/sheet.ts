// Gesture rules shared by every bottom sheet. The drag follows the finger down, ignores
// going up and closes on distance or on a quick flick.

const FLICK_SPEED = 0.6; // px per ms
const FLICK_MIN = 24; // a twitch shorter than this is not a flick
const CLOSE_RATIO = 1 / 3;

/** Translate for a finger that moved `dy` px from where it landed (down is positive).
 * Pulling up does nothing (R5.6): lifting the sheet exposes a stripe of the page under it. */
export function dragOffset(dy: number): number {
	return dy > 0 ? dy : 0;
}

/** Decide on release. `velocity` is px/ms, positive when moving down. */
export function shouldDismiss(offset: number, height: number, velocity: number): boolean {
	if (offset <= 0) return false;
	if (offset >= height * CLOSE_RATIO) return true;
	return velocity >= FLICK_SPEED && offset >= FLICK_MIN;
}

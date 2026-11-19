// The back-to-top arrow appears once the reader is well into a long list.
export const BACK_TO_TOP_AFTER = 1.2; // screens

export function showBackToTop(scrollY: number, viewportHeight: number): boolean {
	return scrollY > viewportHeight * BACK_TO_TOP_AFTER;
}

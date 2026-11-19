// The fan of cards on a Library card (prototype page 2). One layout, used by both
// the CSS-3D renderer and the WebGL scene so they always line up.
export const MAX_FAN = 5;

export interface FanCard {
	/** Horizontal offset from the center, in % of the fan's width. */
	x: number;
	/** Tilt in degrees; positive is clockwise on screen (CSS convention). */
	rotZ: number;
	/** How far the card sits below the center one, in % of the fan's height. */
	drop: number;
	/** Stacking order, strictly increasing toward the front. */
	z: number;
}

const STEP_X = [0, 0, 18, 22, 20, 17]; // by card count
const STEP_ROT = [0, 0, 4, 5, 3.5, 6];

export function fanLayout(count: number): FanCard[] {
	const n = Math.max(0, Math.min(count, MAX_FAN));
	const mid = (n - 1) / 2;
	const top = Math.floor(mid);
	return Array.from({ length: n }, (_, i) => {
		const off = i - mid;
		return {
			x: off * STEP_X[n],
			rotZ: off * STEP_ROT[n],
			drop: off * off * 1.6,
			// Middle card on top; each step outward is one layer lower, the right
			// side just under the left so no two cards share a layer.
			z: 100 - Math.abs(i - top) * 2 - (i > top ? 1 : 0)
		};
	});
}

/** The source name printed on a card (the renderer upper-cases it). */
export function cardLabel(v: { source: 'youtube' | 'direct'; kind: 'video' | 'short' | 'direct' }): string {
	if (v.kind === 'short') return 'Shorts';
	return v.source === 'youtube' ? 'YouTube' : 'MP4';
}

/** What a fan needs to know about a video. */
export interface FanItem {
	id?: string;
	thumbnail?: string;
	source: 'youtube' | 'direct';
	kind: 'video' | 'short' | 'direct';
	embed: { aspect: string };
}

export interface PlacedCard extends FanCard {
	item: FanItem | null;
	/** Shorts, Reels and TikToks stand up; everything else lies down. */
	vertical: boolean;
}

/** Layout plus content: the newest video takes the top layer, older ones fall behind. */
export function fanCards(items: readonly FanItem[]): PlacedCard[] {
	const shown = items.slice(0, MAX_FAN);
	const slots = fanLayout(shown.length);
	const topFirst = slots.map((_, i) => i).sort((a, b) => slots[b].z - slots[a].z);
	const content = new Map<number, FanItem | null>(
		topFirst.map((slot, rank) => [slot, shown[rank] ?? null])
	);
	return slots.map((s, i) => {
		const item = content.get(i) ?? null;
		return { ...s, item, vertical: item?.embed.aspect === '9:16' };
	});
}

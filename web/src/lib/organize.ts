// Order of the user's collections on the Library. Pure: the page only draws what these say.

export type SortMode = 'manual' | 'az' | 'recent' | 'count';

export const SORT_MODES: { mode: SortMode; label: string }[] = [
	{ mode: 'manual', label: 'Minha ordem' },
	{ mode: 'az', label: 'A–Z' },
	{ mode: 'recent', label: 'Mais recentes' },
	{ mode: 'count', label: 'Mais vídeos' }
];

export interface Ranked {
	id: string;
	name: string;
	/** Video ids; only the length matters here. */
	order: string[];
	createdAt: string;
	updatedAt: string;
	/** Place the person gave it by hand; collections without one come after, oldest first. */
	rank?: number;
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const byCreated = (a: Ranked, b: Ranked) => a.createdAt.localeCompare(b.createdAt);

export function sortCollections<T extends Ranked>(list: readonly T[], mode: SortMode): T[] {
	const out = [...list];
	switch (mode) {
		case 'az':
			return out.sort((a, b) => fold(a.name).localeCompare(fold(b.name), 'pt-BR') || byCreated(a, b));
		case 'recent':
			return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || byCreated(a, b));
		case 'count':
			return out.sort((a, b) => b.order.length - a.order.length || byCreated(a, b));
		default:
			return out.sort((a, b) => {
				if (a.rank === undefined && b.rank === undefined) return byCreated(a, b);
				if (a.rank === undefined) return 1;
				if (b.rank === undefined) return -1;
				return a.rank - b.rank || byCreated(a, b);
			});
	}
}

/** A copy of `ids` with the item at `from` placed at `to` (both clamped). */
export function moveTo<T>(ids: readonly T[], from: number, to: number): T[] {
	const out = [...ids];
	if (from < 0 || from >= out.length) return out;
	const target = Math.max(0, Math.min(out.length - 1, to));
	const [item] = out.splice(from, 1);
	out.splice(target, 0, item);
	return out;
}

/** One place up (-1) or down (+1); stays put at the ends. */
export function moveBy(ids: readonly string[], id: string, delta: -1 | 1): string[] {
	const from = ids.indexOf(id);
	return from < 0 ? [...ids] : moveTo(ids, from, from + delta);
}

/** Index of the row under `pageY`, for rows that start at `tops` and are `height` tall. */
export function slotAt(pageY: number, tops: readonly number[], height: number): number {
	for (let i = tops.length - 1; i >= 0; i--) if (pageY >= tops[i]) return pageY < tops[i] + height || i === tops.length - 1 ? i : Math.min(i + 1, tops.length - 1);
	return 0;
}

const KEY = 'octa.sort';

export function loadMode(): SortMode {
	try {
		const v = localStorage.getItem(KEY);
		return SORT_MODES.some((m) => m.mode === v) ? (v as SortMode) : 'manual';
	} catch {
		return 'manual';
	}
}

export function saveMode(mode: SortMode): void {
	try {
		localStorage.setItem(KEY, mode);
	} catch {
		/* private mode: the choice lasts until the page closes */
	}
}

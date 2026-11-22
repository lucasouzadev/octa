// Order of the user's collections on the Library, and of the videos inside one. Pure: the page only draws what these say.
import { cardLabel } from '#lib/fan.ts';

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

/**
 * The Library's cards: the collections plus the default ones (Todos, Favoritos, Assistidos), in one order.
 * By hand, each default sits at the place saved for it on this device (index in the final list; unsaved ones
 * keep their usual order on top). Any other sort treats the defaults like collections.
 */
export function arrange<T extends Ranked>(collections: readonly T[], defaults: readonly T[], mode: SortMode, slots: DefaultSlots): T[] {
	if (mode !== 'manual') return sortCollections([...collections, ...defaults], mode);
	const out = sortCollections(collections, 'manual');
	const placed = defaults
		.map((d, i) => ({ d, at: slots[d.id] ?? i }))
		.sort((a, b) => a.at - b.at);
	for (const { d, at } of placed) out.splice(Math.min(at, out.length), 0, d);
	return out;
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

/** Screens that remember how they sort. The Library is "home"; the collection picker is "move". */
export type SortScreen = 'home' | 'move';

const LEGACY_KEY = 'octa.sort'; // one choice for every screen, before R5.2
const keyFor = (screen: SortScreen) => `octa.sort.${screen}`;
const isMode = (v: string | null): v is SortMode => SORT_MODES.some((m) => m.mode === v);

export function loadMode(screen: SortScreen = 'home'): SortMode {
	try {
		const own = localStorage.getItem(keyFor(screen));
		if (isMode(own)) return own;
		if (own === null) {
			const old = localStorage.getItem(LEGACY_KEY);
			if (isMode(old)) return old;
		}
		return 'manual';
	} catch {
		return 'manual';
	}
}

export function saveMode(mode: SortMode, screen: SortScreen = 'home'): void {
	try {
		localStorage.setItem(keyFor(screen), mode);
	} catch {
		/* private mode: the choice lasts until the page closes */
	}
}

export type VideoSort = 'date' | 'title' | 'source';

export const VIDEO_SORTS: { mode: VideoSort; label: string }[] = [
	{ mode: 'date', label: 'Data' },
	{ mode: 'title', label: 'Título' },
	{ mode: 'source', label: 'Origem' }
];

interface Sortable {
	title: string;
	createdAt: string;
	source: Parameters<typeof cardLabel>[0]['source'];
	kind: Parameters<typeof cardLabel>[0]['kind'];
}

const newestFirst = (a: Sortable, b: Sortable) => b.createdAt.localeCompare(a.createdAt);

/** A one-time sort of a collection's videos (the caller writes the result as the new order). */
export function sortVideos<T extends Sortable>(list: readonly T[], mode: VideoSort): T[] {
	const out = [...list];
	switch (mode) {
		case 'title':
			return out.sort((a, b) => fold(a.title).localeCompare(fold(b.title), 'pt-BR') || newestFirst(a, b));
		case 'source':
			return out.sort((a, b) => cardLabel(a).localeCompare(cardLabel(b), 'pt-BR') || newestFirst(a, b));
		default:
			return out.sort(newestFirst);
	}
}

// R5.2 follow-up: the video sort last chosen in a collection is remembered on this device, per collection.
// It only remembers the choice (shown as pressed); the saved order is written on the press, as before.
const videoSortKey = (collectionId: string) => `octa.vsort.${collectionId}`;

export function loadVideoSort(collectionId: string): VideoSort | null {
	try {
		const raw = localStorage.getItem(videoSortKey(collectionId));
		return VIDEO_SORTS.some((s) => s.mode === raw) ? (raw as VideoSort) : null;
	} catch {
		return null;
	}
}

export function saveVideoSort(collectionId: string, mode: VideoSort): void {
	try {
		localStorage.setItem(videoSortKey(collectionId), mode);
	} catch {
		/* storage blocked: the sort still applies, it just is not remembered */
	}
}

// R6.1: where Todos, Favoritos and Assistidos sit in the Library. They are not stored collections, so
// their places live on this device only (index in the visible list).
export type DefaultSlots = Record<string, number>;

const DEFAULTS_KEY = 'octa.order.defaults';
const DEFAULT_IDS = ['todos', 'favoritos', 'assistidos'];

export function loadDefaultSlots(): DefaultSlots {
	try {
		const raw = JSON.parse(localStorage.getItem(DEFAULTS_KEY) ?? '{}') as Record<string, unknown>;
		const out: DefaultSlots = {};
		for (const id of DEFAULT_IDS) {
			const v = Object.hasOwn(raw, id) ? raw[id] : undefined;
			if (typeof v === 'number' && Number.isInteger(v) && v >= 0) out[id] = v;
		}
		return out;
	} catch {
		return {};
	}
}

export function saveDefaultSlots(slots: DefaultSlots): void {
	try {
		localStorage.setItem(DEFAULTS_KEY, JSON.stringify(slots));
	} catch {
		/* storage blocked: the places last until the page closes */
	}
}

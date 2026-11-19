import { CollectionError, type Library, type Video } from './library';

/** URL scope meaning "the whole library" (the virtual "Todos" collection). */
export const ALL = 'todos';

/**
 * The videos a screen or the player works over: a user collection in its own
 * order, or the whole library newest first. An unknown collection id (deleted,
 * stale link) falls back to the whole library instead of an error screen.
 */
export async function videosIn(lib: Library, scope: string | null): Promise<Video[]> {
	if (scope && scope !== ALL) {
		try {
			return await lib.listVideos(scope);
		} catch (e) {
			if (!(e instanceof CollectionError)) throw e;
		}
	}
	return lib.list();
}

/**
 * What the player walks for `videoId`: the requested scope when it really
 * contains the video, otherwise the whole library (never a dead end).
 */
export async function playlistFor(
	lib: Library,
	scope: string | null,
	videoId: string
): Promise<{ scope: string; videos: Video[] }> {
	if (scope && scope !== ALL) {
		const videos = await videosIn(lib, scope);
		if (videos.some((v) => v.id === videoId)) return { scope, videos };
	}
	return { scope: ALL, videos: await lib.list() };
}

import { Library } from './library';

let opening: Promise<Library> | undefined;

/** The app-wide library, opened once on first use. */
export function library(): Promise<Library> {
	return (opening ??= Library.open());
}

export { CollectionError, COLLECTION_NAME_MAX } from './library';
export type { Video, Health, Collection } from './library';

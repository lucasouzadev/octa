import { Library } from './library';

let opening: Promise<Library> | undefined;

/** The app-wide library, opened once on first use. */
export function library(): Promise<Library> {
	return (opening ??= Library.open());
}

export type { Video, Health } from './library';

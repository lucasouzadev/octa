// What the OS share sheet (Web Share Target) hands to /add: a link in `url`, or, on Android,
// inside `text` / `title`. Only an http(s) link is ever taken; the rest is ignored.
const LINK = /https?:\/\/[^\s<>"']+/i;
const MAX_READ = 4096;

export function sharedLink(params: { get(name: string): string | null }): string {
	for (const key of ['url', 'text', 'title']) {
		const raw = (params.get(key) ?? '').slice(0, MAX_READ);
		const found = raw.match(LINK)?.[0];
		if (found) return found.replace(/[.,;:!?)\]]+$/, '');
	}
	return '';
}

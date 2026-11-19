// Client-side mirror of api/internal/provider. Both read testdata/urls.json in
// their tests: change a rule in one place, change it in both.

export const MAX_URL_LENGTH = 2048;

export type Source = 'youtube' | 'direct';
export type Kind = 'video' | 'short' | 'direct';
export type Aspect = '16:9' | '9:16';

export interface Embed {
	type: 'iframe' | 'video' | 'hls';
	src: string;
	aspect: Aspect;
}

export interface Ref {
	source: Source;
	kind: Kind;
	id: string;
	canonicalUrl: string;
	embed: Embed;
	title?: string;
}

export class LinkError extends Error {
	constructor(public code: 'invalid_url' | 'unsupported_url') {
		super(code);
		this.name = 'LinkError';
	}
}

const SCHEME_RE = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const YT_START_RE = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/;
const YT_HOSTS = new Set([
	'youtube.com',
	'm.youtube.com',
	'music.youtube.com',
	'youtu.be',
	'youtube-nocookie.com'
]);
const DIRECT_EXTS = new Set(['.mp4', '.m4v', '.webm', '.mov']);

export function parseLink(raw: string): Ref {
	const u = normalize(raw);
	const host = u.hostname.replace(/^www\./, '');
	if (YT_HOSTS.has(host)) {
		const ref = parseYouTube(u, host);
		if (!ref) throw new LinkError('unsupported_url');
		return ref;
	}
	const direct = parseDirect(u);
	if (direct) return direct;
	throw new LinkError('unsupported_url');
}

function normalize(raw: string): URL {
	let s = raw.trim();
	if (!s || s.length > MAX_URL_LENGTH || /\s/.test(s)) throw new LinkError('invalid_url');
	if (!SCHEME_RE.test(s)) s = 'https://' + s;
	let u: URL;
	try {
		u = new URL(s);
	} catch {
		throw new LinkError('invalid_url');
	}
	if ((u.protocol !== 'https:' && u.protocol !== 'http:') || !u.hostname || u.username || u.password) {
		throw new LinkError('invalid_url');
	}
	return u;
}

function parseYouTube(u: URL, host: string): Ref | null {
	const segs = u.pathname.replace(/^\/+|\/+$/g, '').split('/');
	let id = '';
	let kind: Kind = 'video';
	if (host === 'youtu.be') id = segs[0] ?? '';
	else if (segs[0] === 'watch') id = u.searchParams.get('v') ?? '';
	else if (segs[0] === 'shorts' && segs[1]) [id, kind] = [segs[1], 'short'];
	else if ((segs[0] === 'live' || segs[0] === 'embed') && segs[1]) id = segs[1];
	if (!YT_ID_RE.test(id)) return null;

	const short = kind === 'short';
	let src = `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0`;
	const start = ytStart(u.searchParams);
	if (start > 0) src += `&start=${start}`;
	return {
		source: 'youtube',
		kind,
		id,
		canonicalUrl: short
			? `https://www.youtube.com/shorts/${id}`
			: `https://www.youtube.com/watch?v=${id}`,
		embed: { type: 'iframe', src, aspect: short ? '9:16' : '16:9' }
	};
}

function ytStart(q: URLSearchParams): number {
	const v = q.get('t') || q.get('start') || '';
	const m = v ? YT_START_RE.exec(v) : null;
	if (!m) return 0;
	return [3600, 60, 1].reduce((sum, mult, i) => sum + (Number(m[i + 1]) || 0) * mult, 0);
}

function parseDirect(u: URL): Ref | null {
	const base = u.pathname.split('/').pop() ?? '';
	const dot = base.lastIndexOf('.');
	const ext = dot >= 0 ? base.slice(dot).toLowerCase() : '';
	if (!DIRECT_EXTS.has(ext)) return null;
	const c = new URL(u.href);
	c.hash = '';
	const canonical = c.href;
	let title = base.slice(0, dot);
	try {
		title = decodeURIComponent(title);
	} catch {
		/* keep the raw name */
	}
	return {
		source: 'direct',
		kind: 'direct',
		id: canonical,
		canonicalUrl: canonical,
		embed: { type: 'video', src: canonical, aspect: '16:9' },
		title
	};
}

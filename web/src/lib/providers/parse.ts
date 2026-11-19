// Client-side mirror of api/internal/provider. Both read testdata/urls.json in
// their tests: change a rule in one place, change it in both.

export const MAX_URL_LENGTH = 2048;

export type Source = 'youtube' | 'instagram' | 'tiktok' | 'direct';
export type Kind = 'video' | 'short' | 'reel' | 'direct' | 'hls';
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
const IG_CODE_RE = /^[A-Za-z0-9_-]+$/;
const TT_ID_RE = /^[0-9]{5,25}$/;
const TT_USER_RE = /^@[A-Za-z0-9._-]{1,64}$/;
// Hides TikTok's own chrome: octa draws one control bar for every source (slice 3c).
// developers.tiktok.com/doc/embed-player, read 2026-11-19.
const TT_PLAYER_PARAMS =
	'?controls=0&progress_bar=0&play_button=0&volume_control=0&fullscreen_button=0&timestamp=0&music_info=0&description=0&rel=0&native_context_menu=0';
const TT_HOSTS = new Set(['tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com']);

export function parseLink(raw: string): Ref {
	const u = normalize(raw);
	const host = u.hostname.replace(/^www\./, '');
	if (YT_HOSTS.has(host)) {
		const ref = parseYouTube(u, host);
		if (!ref) throw new LinkError('unsupported_url');
		return ref;
	}
	if (host === 'instagram.com') {
		const ref = parseInstagram(u);
		if (!ref) throw new LinkError('unsupported_url');
		return ref;
	}
	if (TT_HOSTS.has(host)) {
		// vm./vt. short links only resolve through a redirect, which the API follows.
		const ref = parseTikTok(u, host);
		if (!ref) throw new LinkError('unsupported_url');
		return ref;
	}
	const direct = parseDirect(u);
	if (direct) return direct;
	throw new LinkError('unsupported_url');
}

function parseInstagram(u: URL): Ref | null {
	const segs = u.pathname.replace(/^\/+|\/+$/g, '').split('/');
	const code = segs[1] ?? '';
	if (segs.length < 2 || !IG_CODE_RE.test(code)) return null;
	let kind: Kind;
	let canonical: string;
	if (segs[0] === 'reel' || segs[0] === 'reels') [kind, canonical] = ['reel', `https://www.instagram.com/reel/${code}/`];
	else if (segs[0] === 'p') [kind, canonical] = ['video', `https://www.instagram.com/p/${code}/`];
	else if (segs[0] === 'tv') [kind, canonical] = ['video', `https://www.instagram.com/tv/${code}/`];
	else return null;
	return {
		source: 'instagram',
		kind,
		id: code,
		canonicalUrl: canonical,
		embed: { type: 'iframe', src: `${canonical}embed/`, aspect: '9:16' }
	};
}

function parseTikTok(u: URL, host: string): Ref | null {
	if (host !== 'tiktok.com' && host !== 'm.tiktok.com') return null;
	const segs = u.pathname.replace(/^\/+|\/+$/g, '').split('/');
	if (segs.length < 3 || !TT_USER_RE.test(segs[0]) || segs[1] !== 'video' || !TT_ID_RE.test(segs[2])) return null;
	const id = segs[2];
	return {
		source: 'tiktok',
		kind: 'short',
		id,
		canonicalUrl: `https://www.tiktok.com/${segs[0]}/video/${id}`,
		embed: { type: 'iframe', src: `https://www.tiktok.com/player/v1/${id}${TT_PLAYER_PARAMS}`, aspect: '9:16' }
	};
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
	const hls = ext === '.m3u8';
	if (!DIRECT_EXTS.has(ext) && !hls) return null;
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
		kind: hls ? 'hls' : 'direct',
		id: canonical,
		canonicalUrl: canonical,
		embed: { type: hls ? 'hls' : 'video', src: canonical, aspect: '16:9' },
		title
	};
}

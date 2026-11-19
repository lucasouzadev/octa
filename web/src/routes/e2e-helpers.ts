import type { Locator, Page } from '@playwright/test';

// The Go API is mocked here; its own tests cover it. Everything off localhost is
// blocked so runs are deterministic and never hit YouTube.
export interface HealthCall {
	items: { id: string; url: string }[];
	fresh: boolean;
}

// By default every link answers "unknown", which changes nothing, so a test never
// depends on the date. A test that cares passes `health` to decide the answers.
export interface NetworkOptions {
	apiDown?: boolean;
	health?: (call: HealthCall) => string;
}

export async function mockNetwork(page: Page, opts: NetworkOptions = {}) {
	const healthCalls: HealthCall[] = [];
	await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
	await page.route('**/api/v1/health', async (route) => {
		if (opts.apiDown) return route.fulfill({ status: 502, body: '' });
		const body = route.request().postDataJSON() as { items: HealthCall['items']; fresh?: boolean };
		const call = { items: body.items, fresh: body.fresh === true };
		healthCalls.push(call);
		const health = opts.health?.(call) ?? 'unknown';
		await route.fulfill({
			json: { results: call.items.map((i) => ({ id: i.id, health, checkedAt: new Date().toISOString() })) }
		});
	});
	await page.route('**/api/v1/resolve', async (route) => {
		if (opts.apiDown) return route.fulfill({ status: 502, body: '' });
		const { url } = route.request().postDataJSON() as { url: string };
		const short = url.includes('/shorts/');
		const id = short ? 'aBcDeFgHiJ0' : 'dQw4w9WgXcQ';
		await route.fulfill({
			json: {
				source: 'youtube',
				kind: short ? 'short' : 'video',
				id,
				canonicalUrl: short ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`,
				embed: {
					type: 'iframe',
					src: `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0`,
					aspect: short ? '9:16' : '16:9'
				},
				title: short ? 'Três acordes que mudaram tudo' : 'Sessão ao vivo no terraço',
				author: short ? 'Nota Solta' : 'Casa Aberta',
				thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
				durationSec: null,
				health: 'alive',
				checkedAt: '2026-11-19T12:00:00Z'
			}
		});
	});
	return { healthCalls };
}

// Typing docks the field above the keyboard on touch projects, and the bar sits over the
// page's own button. A real user taps outside first; so does this.
export async function fillField(field: Locator, value: string) {
	await field.fill(value);
	await field.blur();
}

export async function paste(page: Page, link: string) {
	await page.goto('/add');
	await fillField(page.getByLabel('Link do vídeo'), link);
	await page.getByRole('button', { name: 'Gerar player' }).click();
}

// A stand-in for https://www.youtube.com/iframe_api (the real one is unreachable in
// tests). It follows the documented surface: YT.Player(el, { videoId, host, playerVars,
// events }) builds the iframe, fires onReady, and records every call in window.__yt.
export async function fakeYouTube(page: Page) {
	await page.route('https://www.youtube.com/iframe_api', (route) =>
		route.fulfill({
			contentType: 'text/javascript',
			body: `
window.__yt = { calls: [], options: null };
window.YT = { Player: function (el, o) {
	window.__yt.options = { videoId: o.videoId, host: o.host, playerVars: o.playerVars };
	var f = document.createElement('iframe');
	f.src = o.host + '/embed/' + o.videoId + '?controls=' + o.playerVars.controls + '&enablejsapi=1';
	el.replaceWith(f);
	var t = 0, d = 212, self = this;
	this.getIframe = function () { return f; };
	// window.__ytBlock = true imitates iOS refusing to start a video that was not tapped.
	this.playVideo = function () { window.__yt.calls.push('play'); if (window.__ytBlock) return; o.events.onStateChange({ data: 1 }); };
	this.pauseVideo = function () { window.__yt.calls.push('pause'); o.events.onStateChange({ data: 2 }); };
	this.seekTo = function (s) { window.__yt.calls.push('seek:' + Math.round(s)); t = s; };
	this.getCurrentTime = function () { return t; };
	this.getDuration = function () { return d; };
	this.destroy = function () { window.__yt.calls.push('destroy'); };
	window.__yt.end = function () { o.events.onStateChange({ data: 0 }); };
	setTimeout(function () { o.events.onReady({ target: self }); }, 30);
} };
window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady();`
		})
	);
}

// Raw IndexedDB access, so a test can age a video the way time would.
export const patchVideo = (page: Page, patch: Record<string, unknown>) =>
	page.evaluate(
		(p) =>
			new Promise<void>((resolve, reject) => {
				const open = indexedDB.open('octa');
				open.onerror = () => reject(open.error);
				open.onsuccess = () => {
					const db = open.result;
					const tx = db.transaction('videos', 'readwrite');
					const store = tx.objectStore('videos');
					store.getAll().onsuccess = (e) => {
						for (const v of (e.target as IDBRequest).result) store.put({ ...v, ...p });
					};
					tx.oncomplete = () => (db.close(), resolve());
					tx.onerror = () => reject(tx.error);
				};
			}),
		patch
	);

export const readVideo = (page: Page) =>
	page.evaluate(
		() =>
			new Promise<Record<string, any>>((resolve, reject) => {
				const open = indexedDB.open('octa');
				open.onerror = () => reject(open.error);
				open.onsuccess = () => {
					const db = open.result;
					const req = db.transaction('videos').objectStore('videos').getAll();
					req.onsuccess = () => (db.close(), resolve(req.result[0]));
				};
			})
	);

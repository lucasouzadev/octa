import type { Locator, Page } from '@playwright/test';

// The Go API is mocked here; its own tests cover it. Everything off localhost is
// blocked so runs are deterministic and never hit YouTube.
export async function mockNetwork(page: Page, opts: { apiDown?: boolean } = {}) {
	await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
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
	this.playVideo = function () { window.__yt.calls.push('play'); o.events.onStateChange({ data: 1 }); };
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

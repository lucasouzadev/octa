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

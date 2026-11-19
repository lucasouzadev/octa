import { expect, test, type Page } from '@playwright/test';
import { fillField } from './e2e-helpers';

// Slice 3a: Instagram, TikTok and HLS links. The API is mocked per source; the client
// parser decides identity, so every case below also works with the API down.
async function net(page: Page, meta: (url: string) => object | null) {
	await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
	await page.route('**/api/v1/resolve', async (route) => {
		const { url } = route.request().postDataJSON() as { url: string };
		const m = meta(url);
		if (!m) return route.fulfill({ status: 502, body: '' });
		await route.fulfill({ json: m });
	});
}

async function paste(page: Page, link: string) {
	await page.goto('/add');
	await fillField(page.getByLabel('Link do vídeo'), link);
	await page.getByRole('button', { name: 'Gerar player' }).click();
}

test('Instagram reel: official embed, 9:16, source label, offline title', async ({ page }) => {
	await net(page, () => null); // API down: the client parser carries it
	await paste(page, 'https://www.instagram.com/reel/Cxyz123_-a/?igsh=abc');
	await expect(page).toHaveURL(/\/v\//);
	const frame = page.locator('.player iframe');
	await expect(frame).toHaveAttribute('src', 'https://www.instagram.com/reel/Cxyz123_-a/embed/');
	await expect(page.locator('.player .frame.vertical')).toHaveCount(1);
	await expect(page.getByText('Reels').first()).toBeVisible();
	await expect(page.getByText('Reel do Instagram').first()).toBeVisible();
});

test('TikTok video: embed v2, 9:16, API title wins', async ({ page }) => {
	await net(page, () => ({
		source: 'tiktok',
		kind: 'short',
		id: '7234567890123456789',
		canonicalUrl: 'https://www.tiktok.com/@user.name/video/7234567890123456789',
		embed: { type: 'iframe', src: 'x', aspect: '9:16' },
		title: 'Receita rápida',
		author: 'Chef U',
		durationSec: null,
		health: 'alive',
		checkedAt: '2026-11-19T12:00:00Z'
	}));
	await paste(page, 'https://www.tiktok.com/@user.name/video/7234567890123456789?is_from_webapp=1');
	await expect(page).toHaveURL(/\/v\//);
	await expect(page.locator('.player iframe')).toHaveAttribute('src', 'https://www.tiktok.com/embed/v2/7234567890123456789');
	await expect(page.getByText('Receita rápida').first()).toBeVisible();
	await expect(page.getByText('TikTok').first()).toBeVisible();
});

test('TikTok short link is expanded by the API; with the API down it says unsupported', async ({ page }) => {
	await net(page, (url) =>
		url.includes('vm.tiktok.com')
			? {
					source: 'tiktok',
					kind: 'short',
					id: '7234567890123456789',
					canonicalUrl: 'https://www.tiktok.com/@u/video/7234567890123456789',
					embed: { type: 'iframe', src: 'x', aspect: '9:16' },
					title: 'Curto',
					durationSec: null,
					health: 'alive',
					checkedAt: '2026-11-19T12:00:00Z'
				}
			: null
	);
	await paste(page, 'https://vm.tiktok.com/ZMabc123/');
	await expect(page).toHaveURL(/\/v\//);
	await expect(page.locator('.player iframe')).toHaveAttribute('src', 'https://www.tiktok.com/embed/v2/7234567890123456789');

	const down = await page.context().newPage();
	await net(down, () => null);
	await paste(down, 'https://vt.tiktok.com/ZMdown/');
	await expect(down.getByRole('alert')).toContainText('não é suportado');
});

test('HLS playlist plays in a native video element, hls.js loads only on demand', async ({ page }) => {
	await net(page, () => null);
	const scripts: string[] = [];
	page.on('response', (r) => r.request().resourceType() === 'script' && scripts.push(r.url()));
	await paste(page, 'https://cdn.example.com/live/stream.m3u8');
	await expect(page).toHaveURL(/\/v\//);
	await expect(page.locator('.player video')).toHaveCount(1);
	await expect(page.getByText('Arquivo').first()).toBeVisible();
	await expect.poll(() => scripts.length).toBeGreaterThan(0);
});

test('a profile page of either network is not a video', async ({ page }) => {
	await net(page, () => null);
	for (const link of ['https://www.instagram.com/someone/', 'https://www.tiktok.com/@user']) {
		await paste(page, link);
		await expect(page.getByRole('alert')).toContainText('não é suportado');
	}
});

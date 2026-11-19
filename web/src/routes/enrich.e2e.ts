import { expect, test } from '@playwright/test';
import { paste } from './e2e-helpers';

// The API is "asleep" at paste time and awake when the Library opens later.
test('a video saved while the API was down gets its real title back on the Library', async ({ page }) => {
	let apiUp = false;
	await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
	await page.route('**/api/v1/resolve', (route) => {
		if (!apiUp) return route.fulfill({ status: 502, body: '' });
		return route.fulfill({
			json: {
				source: 'youtube',
				kind: 'video',
				id: 'dQw4w9WgXcQ',
				canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
				embed: { type: 'iframe', src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?playsinline=1&rel=0', aspect: '16:9' },
				title: 'Sessão ao vivo no terraço',
				author: 'Casa Aberta',
				thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
				durationSec: null,
				health: 'alive',
				checkedAt: '2026-11-19T12:00:00Z'
			}
		});
	});

	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await expect(page).toHaveURL(/\/v\//);
	await page.goto('/c/todos');
	await expect(page.getByText('Vídeo do YouTube')).toBeVisible();

	apiUp = true;
	const resolved = page.waitForResponse('**/api/v1/resolve');
	await page.goto('/');
	await resolved; // the Library asked again once the API was up
	// The write to IndexedDB lands a moment after the response; retry the read.
	await expect(async () => {
		await page.goto('/c/todos');
		await expect(page.getByText('Sessão ao vivo no terraço')).toBeVisible({ timeout: 1500 });
	}).toPass({ timeout: 10_000 });
	await expect(page.getByText('Casa Aberta')).toBeVisible();
	await expect(page.getByText('Vídeo do YouTube')).toHaveCount(0);
});

test('a dark screen paints the whole page dark (iOS status-bar strip)', async ({ page }) => {
	await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
	await page.goto('/c/todos');
	await expect(page.locator('.collection')).toBeVisible();
	const bg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
	expect(bg).not.toBe('rgb(255, 255, 255)');
	await page.goto('/');
	const light = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
	expect(light).not.toBe(bg);
});

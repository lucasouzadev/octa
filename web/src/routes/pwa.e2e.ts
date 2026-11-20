import { expect, test, type Page } from '@playwright/test';

// The one file that lets the service worker run (the config blocks it elsewhere).
test.use({ serviceWorkers: 'allow' });

async function controlled(page: Page) {
	await page.goto('/');
	await page.evaluate(() => navigator.serviceWorker.ready);
	// A worker only controls pages loaded after it activates (it does not claim): reload once.
	await page.reload();
	await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

test.describe('R7 installable PWA', () => {
	test('the manifest is linked and has what Chrome needs to offer install', async ({ page, request }) => {
		await page.goto('/');
		await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
		const m = await (await request.get('/manifest.webmanifest')).json();
		expect(m).toMatchObject({ name: 'octa', short_name: 'octa', start_url: '/', scope: '/', display: 'standalone', theme_color: '#000000', background_color: '#000000' });
		const sizes = m.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}:${i.purpose}`);
		expect(sizes).toEqual(expect.arrayContaining(['192x192:any', '512x512:any', '512x512:maskable']));
		for (const icon of m.icons) {
			const res = await request.get(icon.src);
			expect(res.ok(), icon.src).toBe(true);
			expect(res.headers()['content-type']).toContain('image/png');
		}
		expect((await request.get('/icons/apple-touch-icon.png')).ok()).toBe(true);
		await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
	});

	test('the share target hands title, text and url to /add by GET', async ({ request }) => {
		const m = await (await request.get('/manifest.webmanifest')).json();
		expect(m.share_target).toEqual({ action: '/add', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } });
	});

	test('a shared link lands in the paste field, from url or from the text', async ({ page }) => {
		await page.goto('/add?url=' + encodeURIComponent('https://youtu.be/dQw4w9WgXcQ'));
		await expect(page.getByLabel('Link do vídeo')).toHaveValue('https://youtu.be/dQw4w9WgXcQ');
		await page.goto('/add?title=Video&text=' + encodeURIComponent('Veja isto https://youtu.be/dQw4w9WgXcQ agora'));
		await expect(page.getByLabel('Link do vídeo')).toHaveValue('https://youtu.be/dQw4w9WgXcQ');
		await page.goto('/add?text=so+texto');
		await expect(page.getByLabel('Link do vídeo')).toHaveValue('');
	});
});

test.describe('R7 offline shell', () => {
	test('the Library opens with no network once the app was loaded', async ({ page, context }) => {
		await controlled(page);
		await context.setOffline(true);
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Minha coleção' })).toBeVisible(); // booted from the cached shell
		await page.goto('/c/new'); // any route: the shell boots the client router
		await expect(page.getByLabel('Nome da coleção')).toBeVisible();
	});

	test('the library data is still there offline', async ({ page, context }) => {
		await page.route('**/api/**', (r) => r.fulfill({ status: 503, body: '' }));
		await controlled(page);
		await page.goto('/c/new');
		await page.getByLabel('Nome da coleção').fill('Offline');
		await page.getByRole('button', { name: 'Criar coleção' }).click();
		await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
		await context.setOffline(true);
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Minha coleção' })).toBeVisible();
	});

	test('only the app itself is cached: no other origin, no /api, no video', async ({ page }) => {
		await controlled(page);
		const stored = await page.evaluate(async () => {
			const out: string[] = [];
			for (const name of await caches.keys()) for (const req of await (await caches.open(name)).keys()) out.push(req.url);
			return out;
		});
		expect(stored.length).toBeGreaterThan(5);
		const origin = new URL(page.url()).origin;
		for (const url of stored) {
			expect(url.startsWith(origin + '/'), url).toBe(true);
			expect(url).not.toContain('/api/');
			expect(url).not.toMatch(/\.(mp4|webm|m3u8|ts)(\?|$)/);
		}
		expect(stored).toContain(origin + '/');
	});

	test('a new build replaces the old cache instead of piling up', async ({ page }) => {
		await controlled(page);
		const names = await page.evaluate(() => caches.keys());
		expect(names.filter((n) => n.startsWith('octa-shell-'))).toHaveLength(1);
	});
});

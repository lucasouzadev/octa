import { expect, test, type Page } from '@playwright/test';
import { mockNetwork, paste } from './e2e-helpers';

// Slice 2e-3: WebGL monitors on the Collection screen. Headless Chromium reports 2
// cores, so tests pretend to be a strong device.
async function strongDevice(page: Page) {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
	});
}

async function seed(page: Page) {
	await mockNetwork(page);
	await page.route('https://i.ytimg.com/**', (route) => {
		const hue = route.request().url().includes('aBcDeFgHiJ0') ? 28 : 215;
		route.fulfill({
			contentType: 'image/svg+xml',
			headers: { 'access-control-allow-origin': '*' },
			body: `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="hsl(${hue} 80% 50%)"/><circle cx="240" cy="180" r="90" fill="rgba(255,255,255,.85)"/></svg>`
		});
	});
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await expect(page).toHaveURL(/\/v\//);
	await paste(page, 'https://www.youtube.com/shorts/aBcDeFgHiJ0');
	await expect(page).toHaveURL(/\/v\//);
}

test('a capable device draws the monitors in one WebGL canvas; the rows stay links', async ({ page }, testInfo) => {
	await strongDevice(page);
	await seed(page);
	await page.goto('/c/todos');
	await expect(page.locator('ul.videos.gl')).toHaveCount(1);
	await expect(page.locator('canvas')).toHaveCount(1);
	await page.waitForTimeout(600);
	await page.screenshot({ path: `test-results/monitors/${testInfo.project.name}-gl.png` });
	// The row still exists for touch, focus and screen readers, and paints nothing itself.
	const row = page.locator('a.screen').first();
	await expect(row).toBeVisible();
	await expect(row.locator('.name')).toHaveCSS('opacity', '0');
	await row.click();
	await expect(page).toHaveURL(/\/v\//);
});

test('the monitors show the cover, not a flat grey', async ({ page }, testInfo) => {
	await strongDevice(page);
	await seed(page);
	await page.goto('/c/todos');
	await expect(page.locator('ul.videos.gl')).toHaveCount(1);
	await page.waitForTimeout(600);
	const shot = await page.screenshot();
	const strongest = await page.evaluate(async (b64) => {
		const img = await createImageBitmap(new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))]));
		const c = new OffscreenCanvas(img.width, img.height);
		const g = c.getContext('2d')!;
		g.drawImage(img, 0, 0);
		let best = 0;
		for (let y = 0; y < img.height; y += 6) {
			for (let x = 0; x < img.width; x += 6) {
				const [r, , bl] = g.getImageData(x, y, 1, 1).data;
				best = Math.max(best, Math.abs(r - bl));
			}
		}
		return best;
	}, shot.toString('base64'));
	expect(strongest, testInfo.project.name).toBeGreaterThan(100);
});

test('reduced motion, a weak device and editing keep the CSS monitors', async ({ page }) => {
	await seed(page); // 2 cores: not capable
	await page.goto('/c/todos');
	await expect(page.locator('a.screen').first()).toBeVisible();
	await page.waitForTimeout(500);
	await expect(page.locator('canvas')).toHaveCount(0);
	await expect(page.locator('ul.videos.gl')).toHaveCount(0);

	await strongDevice(page);
	await page.reload();
	await expect(page.locator('ul.videos.gl')).toHaveCount(1);
	await page.getByRole('button', { name: 'Editar' }).click();
	await expect(page.locator('ul.videos.gl')).toHaveCount(0);
	await expect(page.locator('canvas')).toHaveCount(0);
	await expect(page.locator('a.screen').first().locator('.name')).toHaveCSS('opacity', '1');
});

test('Favoritos draws the heart in the canvas', async ({ page }, testInfo) => {
	await strongDevice(page);
	await seed(page);
	await page.goto('/v/' + (await page.evaluate(() => new Promise<string>((res) => {
		const r = indexedDB.open('octa');
		r.onsuccess = () => {
			const t = r.result.transaction('videos').objectStore('videos').getAllKeys();
			t.onsuccess = () => res(String(t.result[0]));
		};
	}))) + '?c=todos');
	await page.getByRole('button', { name: 'Curtir' }).click();
	await expect(page.getByRole('button', { name: 'Curtir' })).toHaveAttribute('aria-pressed', 'true');
	await page.waitForTimeout(300); // the write to IndexedDB follows the state change
	await page.goto('/c/favoritos');
	await expect(page.locator('ul.videos.gl')).toHaveCount(1);
	await page.waitForTimeout(600);
	await page.screenshot({ path: `test-results/monitors/${testInfo.project.name}-favoritos.png` });
});

test('an idle pile draws nothing; scrolling and the mouse draw only while they move', async ({ page }, testInfo) => {
	await page.addInitScript(() => {
		const w = window as unknown as { __draws: number };
		w.__draws = 0;
		for (const proto of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype]) {
			const original = proto.drawElements;
			proto.drawElements = function (...args: Parameters<typeof original>) {
				w.__draws++;
				return original.apply(this, args);
			};
		}
	});
	await strongDevice(page);
	await seed(page);
	await page.goto('/c/todos');
	await expect(page.locator('ul.videos.gl')).toHaveCount(1);
	const draws = () => page.evaluate(() => (window as unknown as { __draws: number }).__draws);
	const stable = () =>
		expect
			.poll(async () => {
				const a = await draws();
				await page.waitForTimeout(500);
				return (await draws()) === a;
			}, { timeout: 10000 })
			.toBe(true);
	await stable(); // covers and fonts arriving late still count as "loading"
	const idle = await draws();

	if (testInfo.project.name === 'desktop') {
		const box = (await page.locator('a.screen').first().boundingBox())!;
		await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
		await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.4, { steps: 6 });
		await expect.poll(draws).toBeGreaterThan(idle);
		await page.mouse.move(2, 2);
		// The spring brings the monitor back, then drawing stops for good.
		await stable();
	}
});

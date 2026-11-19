import { expect, test, type Page } from '@playwright/test';
import { mockNetwork, paste } from './e2e-helpers';

// Headless Chromium reports 2 cores, so the capability gate says "CSS-3D". Tests
// that want WebGL pretend to be a strong device.
async function strongDevice(page: Page) {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
	});
}

async function serveThumbs(page: Page) {
	await mockNetwork(page);
	await page.route('https://i.ytimg.com/**', (route) => {
		const hue = route.request().url().includes('aBcDeFgHiJ0') ? 28 : 215;
		route.fulfill({
			contentType: 'image/svg+xml',
			headers: { 'access-control-allow-origin': '*' },
			body: `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="hsl(${hue} 70% 55%)"/><circle cx="240" cy="180" r="90" fill="rgba(255,255,255,.85)"/></svg>`
		});
	});
}

async function seed(page: Page) {
	await serveThumbs(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await expect(page).toHaveURL(/\/v\//);
	await paste(page, 'https://www.youtube.com/shorts/aBcDeFgHiJ0');
	await expect(page).toHaveURL(/\/v\//);
}

// A big JS download is the 3D chunk (three.js is ~700 KB raw; the app itself is far smaller).
function trackBigScripts(page: Page) {
	const big: string[] = [];
	page.on('response', async (res) => {
		if (res.request().resourceType() !== 'script') return;
		const body = await res.body().catch(() => Buffer.alloc(0));
		if (body.length > 300_000) big.push(res.url());
	});
	return big;
}

test('a capable device gets one WebGL canvas and the CSS fan steps aside', async ({ page }, testInfo) => {
	await strongDevice(page);
	await seed(page);
	await page.goto('/c/new');
	await page.getByLabel('Nome da coleção').fill('Música');
	await page.getByRole('button', { name: 'Criar coleção' }).click();
	await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
	await page.goto('/');
	await expect(page.locator('a.card')).toHaveCount(3); // Todos, Música, Nova coleção
	const todos = page.locator('a.card[data-collection="todos"]');
	await expect(todos.locator('canvas')).toHaveCount(1);
	await expect(todos.locator('.fan.gl')).toHaveCount(1);
	// One canvas on the page at a time, even with several cards on screen.
	await expect(page.locator('canvas')).toHaveCount(1);
	await page.waitForTimeout(400);
	const shot = await todos.screenshot({ path: `test-results/slice2d2/${testInfo.project.name}-webgl-card.png` });
	// Regression guard: the papers must show the thumbnail, not a flat grey (a material
	// that was never recompiled for its texture drew grey while every DOM check passed).
	const strongest = await page.evaluate(async (b64) => {
		const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
		const c = new OffscreenCanvas(img.width, img.height);
		const g = c.getContext('2d')!;
		g.drawImage(img, 0, 0);
		// Scan the fan area: some pixel must be clearly orange or blue, never only grey.
		let best = 0;
		for (let y = Math.round(img.height * 0.1); y < img.height * 0.65; y += 6) {
			for (let x = Math.round(img.width * 0.1); x < img.width * 0.9; x += 6) {
				const [r, , bl] = g.getImageData(x, y, 1, 1).data;
				best = Math.max(best, Math.abs(r - bl));
			}
		}
		return best;
	}, shot.toString('base64'));
	expect(strongest).toBeGreaterThan(60);
});

test('an idle WebGL card draws nothing; tilting draws only while it moves', async ({ page }, testInfo) => {
	test.skip(testInfo.project.name !== 'desktop', 'needs a mouse');
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
	await page.goto('/');
	const todos = page.locator('a.card[data-collection="todos"]');
	await expect(todos.locator('.fan.gl')).toHaveCount(1);
	const draws = () => page.evaluate(() => (window as unknown as { __draws: number }).__draws);
	await page.waitForTimeout(600); // let the last texture frame finish
	const idleStart = await draws();
	await page.waitForTimeout(1500);
	expect(await draws() - idleStart).toBe(0);

	const box = (await todos.boundingBox())!;
	await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.2, { steps: 3 });
	await page.waitForTimeout(200);
	expect(await draws()).toBeGreaterThan(idleStart); // it does draw while moving
	// The spring settles (headless runs below 60 fps, so give it time) and drawing stops.
	let last = -1;
	await expect
		.poll(
			async () => {
				const now = await draws();
				const stable = now === last;
				last = now;
				return stable;
			},
			{ timeout: 8000, intervals: [600] }
		)
		.toBe(true);
	expect((await draws()) - idleStart).toBeLessThan(600);
	const settled = await draws();
	await page.waitForTimeout(1000);
	expect((await draws()) - settled).toBe(0);
});

test('a device that cannot or should not use WebGL never downloads the 3D chunk', async ({ page }) => {
	const big = trackBigScripts(page);
	await seed(page); // default headless: 2 cores
	await page.goto('/');
	await expect(page.locator('a.card[data-collection="todos"] .fan .tile')).toHaveCount(2);
	await page.waitForLoadState('networkidle');
	expect(await page.locator('canvas').count()).toBe(0);
	expect(big).toEqual([]);
});

test('reduced motion and Save-Data keep the CSS fan even on a strong device', async ({ page, browser }) => {
	for (const mode of ['reduced', 'savedata'] as const) {
		const context = await browser.newContext({
			reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference',
			viewport: { width: 390, height: 844 }
		});
		const p = await context.newPage();
		await p.addInitScript((m) => {
			Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
			if (m === 'savedata') Object.defineProperty(navigator, 'connection', { get: () => ({ saveData: true }) });
		}, mode);
		const big = trackBigScripts(p);
		await seed(p);
		await p.goto('/');
		await expect(p.locator('a.card[data-collection="todos"] .fan .tile')).toHaveCount(2);
		await p.waitForLoadState('networkidle');
		expect(await p.locator('canvas').count(), mode).toBe(0);
		expect(big, mode).toEqual([]);
		await context.close();
	}
	void page;
});

test('a lost WebGL context hands the fan back to CSS', async ({ page }) => {
	await strongDevice(page);
	await seed(page);
	await page.goto('/');
	const todos = page.locator('a.card[data-collection="todos"]');
	await expect(todos.locator('.fan.gl')).toHaveCount(1);
	await page.evaluate(() => {
		const canvas = document.querySelector('canvas')!;
		const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGL2RenderingContext;
		gl.getExtension('WEBGL_lose_context')!.loseContext();
	});
	await expect(todos.locator('canvas')).toHaveCount(0);
	await expect(todos.locator('.fan.gl')).toHaveCount(0);
	await expect(todos.locator('.fan .tile')).toHaveCount(2);
});

test('going back and forth does not pile up canvases', async ({ page }) => {
	await strongDevice(page);
	await seed(page);
	for (let i = 0; i < 4; i++) {
		await page.goto('/');
		await expect(page.locator('a.card[data-collection="todos"] .fan.gl')).toHaveCount(1);
		await page.locator('a.card[data-collection="todos"]').click();
		await expect(page).toHaveURL(/\/c\/todos$/);
		await expect(page.locator('canvas')).toHaveCount(0);
		await page.getByRole('link', { name: 'Voltar' }).click();
		await expect(page.locator('canvas')).toHaveCount(1, { timeout: 10_000 });
	}
});

test('hovering a card tilts the WebGL fan and it settles back', async ({ page }, testInfo) => {
	test.skip(testInfo.project.name !== 'desktop', 'pointer tilt needs a mouse');
	await strongDevice(page);
	await seed(page);
	await page.goto('/');
	const todos = page.locator('a.card[data-collection="todos"]');
	await expect(todos.locator('.fan.gl')).toHaveCount(1);
	await page.waitForTimeout(300);
	const box = (await todos.boundingBox())!;
	const before = await todos.screenshot();
	await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.2, { steps: 4 });
	await page.waitForTimeout(500);
	const tilted = await todos.screenshot();
	expect(Buffer.compare(before, tilted)).not.toBe(0);
	await page.mouse.move(box.x - 40, box.y - 40, { steps: 3 });
	await page.waitForTimeout(900);
	const after = await todos.screenshot();
	expect(Buffer.compare(after, tilted)).not.toBe(0);
});

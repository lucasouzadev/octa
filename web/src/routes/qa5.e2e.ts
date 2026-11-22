import { expect, test, type Page } from '@playwright/test';
import { mockNetwork, paste } from './e2e-helpers';

// QA round 5 (owner's iPhone screenshots, 2026-11-22). Written red first: each test pins one
// finding of docs/qa/QA-ROUND-5.md and must fail on the code of main.

async function seed(page: Page) {
	await mockNetwork(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await expect(page).toHaveURL(/\/v\//);
}

const asked = (page: Page) => page.evaluate(() => (window as unknown as { __asked?: number }).__asked ?? 0);

const iosAsks = (page: Page) =>
	page.addInitScript(() => {
		(DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission = () => {
			(window as unknown as { __asked: number }).__asked = ((window as unknown as { __asked?: number }).__asked ?? 0) + 1;
			return Promise.resolve('granted');
		};
	});

test.describe('R5.3 the motion permission is remembered', () => {
	test.beforeEach(({}, info) => {
		test.skip(info.project.name === 'desktop', 'no touch');
	});

	test('once granted, a new launch leans again and never asks', async ({ page }) => {
		await iosAsks(page);
		await seed(page);
		await page.goto('/');
		await page.getByRole('button', { name: 'Organizar', exact: true }).click();
		await page.getByRole('tab', { name: 'Dados', exact: true }).click();
		await page.getByRole('switch', { name: 'Mover com o celular' }).click();
		await expect(page.getByRole('switch', { name: 'Mover com o celular' })).toHaveAttribute('aria-checked', 'true');
		expect(await asked(page)).toBe(1);
		await page.reload(); // a new launch: the init script runs again, the counter restarts
		// iOS lets readings flow again when the grant still holds; the first one switches it on, silently.
		await page.evaluate(() => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { beta: 45, gamma: 0 })));
		await expect(page.locator('html')).toHaveAttribute('data-tilt', 'on');
		expect(await asked(page)).toBe(0);
	});

	test('opening the + menu and tapping around never asks', async ({ page }) => {
		await iosAsks(page);
		await seed(page);
		await page.goto('/');
		await page.getByRole('button', { name: 'Criar conteúdo', exact: true }).click();
		await page.mouse.click(10, 300);
		expect(await asked(page)).toBe(0);
	});
});

test.describe('R5.4 feedback is a banner at the top, not a pill', () => {
	test('the notice spans the screen width, hugs the top and is not rounded like a pill', async ({ page }) => {
		await seed(page);
		await page.goto('/');
		await page.getByRole('button', { name: 'Organizar', exact: true }).click();
		await page.getByRole('tab', { name: 'Dados', exact: true }).click();
		await page.getByLabel('Arquivo da biblioteca').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('not json') });
		const note = page.locator('.banner.shown');
		await expect(note).toBeVisible();
		const box = (await note.boundingBox())!;
		const vp = page.viewportSize()!;
		expect(box.width, 'full width, minus the gutters').toBeGreaterThanOrEqual(vp.width - 40);
		expect(box.y).toBeLessThanOrEqual(24);
		const radius = await note.evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius));
		expect(radius, 'a card corner, not a pill').toBeLessThan(24);
	});
});

// R5.1 / R5.5: the page behind the status bar and the home bar always carries the color of the
// screen it is on, set by the layout itself (not by whichever page happens to be mounted), so a
// navigation or a sheet can never flash the phone's black/white behind the safe areas.
const paint = (page: Page) =>
	page.evaluate(() => ({
		html: getComputedStyle(document.documentElement).backgroundColor,
		body: getComputedStyle(document.body).backgroundColor,
		meta: document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? '',
		inline: document.documentElement.style.backgroundColor
	}));

const rgb = (hex: string) => {
	const n = parseInt(hex.slice(1), 16);
	return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

test.describe('R5.5 the safe areas keep the screen color', () => {
	test('the layout paints html with the theme color on every screen and on the way back', async ({ page }) => {
		await seed(page);
		for (const path of ['/', '/add', '/c/favoritos', '/']) {
			await page.goto(path);
			await page.waitForLoadState('networkidle');
			const p = await paint(page);
			expect(p.inline, `${path}: set by the layout`).toBe(rgb(p.meta));
			expect(p.html, `${path}: html`).toBe(rgb(p.meta));
			expect(p.body, `${path}: body`).toBe(rgb(p.meta));
		}
	});

	test('opening a sheet on the Library keeps the page white behind it', async ({ page }) => {
		await seed(page);
		await page.goto('/');
		await page.getByRole('button', { name: 'Organizar', exact: true }).click();
		const p = await paint(page);
		expect(p.html).toBe(rgb('#FFFFFF'));
		expect(p.inline).toBe(rgb('#FFFFFF'));
	});
});

test.describe('R5.1 no color bar over the top of the Library', () => {
	test('app.css draws no fixed strip above the page', async () => {
		const css = (await import('node:fs')).readFileSync(new URL('../app.css', import.meta.url), 'utf8');
		expect(css, 'the R4.6 black strip experiment is gone').not.toMatch(/html\[data-light[^{]*::before/);
	});
});

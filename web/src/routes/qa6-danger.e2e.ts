import { expect, test, type Page } from '@playwright/test';
import { mockNetwork, paste } from './e2e-helpers';

// R6.4: "Apagar este vídeo?" inside a collection. The safe areas (status bar, home bar) must carry the
// orange of the screen, so the page behind them, the browser chrome and the screen itself agree.

async function openDanger(page: Page) {
	await mockNetwork(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await expect(page).toHaveURL(/\/v\//);
	await page.goto('/c/todos');
	await page.getByRole('button', { name: 'Editar', exact: true }).click();
	await page.getByRole('button', { name: /^Apagar/ }).click();
	await expect(page.getByRole('alertdialog')).toBeVisible();
}

const ORANGE = 'rgb(255, 106, 43)';

test.describe('R6.4 the delete screen inside a collection owns the safe areas', () => {
	test('page, browser chrome and screen are all orange', async ({ page }) => {
		await openDanger(page);
		const p = await page.evaluate(() => ({
			html: getComputedStyle(document.documentElement).backgroundColor,
			body: getComputedStyle(document.body).backgroundColor,
			meta: Array.from(document.querySelectorAll('meta[name="theme-color"]')).map((m) => m.getAttribute('content')),
			scheme: getComputedStyle(document.documentElement).colorScheme
		}));
		expect(p.html, 'html').toBe(ORANGE);
		expect(p.body, 'body').toBe(ORANGE);
		expect(p.meta, 'one theme-color, orange').toEqual(['#FF6A2B']);
	});

	test('the orange screen is what sits at every edge and corner', async ({ page }) => {
		await openDanger(page);
		const hit = await page.evaluate(() => {
			const w = window.innerWidth;
			const h = window.innerHeight;
			const pts: [number, number][] = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1], [w / 2, 0], [w / 2, h - 1]];
			return pts.map(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.danger'));
		});
		expect(hit).toEqual([true, true, true, true, true, true]);
	});

	test('closing it gives the page back its own color', async ({ page }) => {
		await openDanger(page);
		await page.getByRole('button', { name: 'Cancelar' }).click();
		await expect(page.getByRole('alertdialog')).toHaveCount(0);
		const p = await page.evaluate(() => ({
			html: getComputedStyle(document.documentElement).backgroundColor,
			meta: document.querySelector('meta[name="theme-color"]')?.getAttribute('content')
		}));
		expect(p.meta).toBe('#000000');
		expect(p.html).toBe('rgb(0, 0, 0)');
	});
});

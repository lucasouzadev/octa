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

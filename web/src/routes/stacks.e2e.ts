import { expect, test, type Page } from '@playwright/test';
import { mockNetwork, paste } from './e2e-helpers';

// Thumbnails are blocked by mockNetwork; serve flat color images so the 3D
// composition can be seen in screenshots and the image path is exercised.
async function withThumbnails(page: Page) {
	await mockNetwork(page);
	await page.route('https://i.ytimg.com/**', (route) => {
		const hue = route.request().url().includes('aBcDeFgHiJ0') ? 28 : 215;
		route.fulfill({
			contentType: 'image/svg+xml',
			body: `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="640"><rect width="480" height="640" fill="hsl(${hue} 70% 55%)"/><circle cx="240" cy="320" r="90" fill="rgba(255,255,255,.85)"/></svg>`
		});
	});
}

async function seed(page: Page) {
	await withThumbnails(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await expect(page).toHaveURL(/\/v\//);
	await paste(page, 'https://www.youtube.com/shorts/aBcDeFgHiJ0');
	await expect(page).toHaveURL(/\/v\//);
}

test('Library cards show a CSS-3D fan of three papers', async ({ page }) => {
	await seed(page);
	await page.goto('/');
	const fan = page.locator('a.card[data-collection="todos"] .fan');
	await expect(fan.locator('.paper')).toHaveCount(3);
	expect(await fan.evaluate((el) => getComputedStyle(el).perspective)).not.toBe('none');
	const left = await fan.locator('.left').evaluate((el) => getComputedStyle(el).transform);
	expect(left).not.toBe('none');
	// The fan is decoration: nothing for a screen reader to read, and the card keeps its name.
	await expect(fan).toHaveAttribute('aria-hidden', 'true');
	await expect(page.getByRole('heading', { name: 'Todos', exact: true })).toBeVisible();
});

test('the Collection screen shows a tipped paper stack', async ({ page }, testInfo) => {
	await seed(page);
	await page.goto('/c/todos');
	const stack = page.locator('.stack');
	await expect(stack.locator('.paper')).toHaveCount(2);
	expect(await stack.evaluate((el) => getComputedStyle(el).perspective)).not.toBe('none');
	await page.waitForLoadState('networkidle');
	const dir = `test-results/slice2d/${testInfo.project.name}`;
	await page.screenshot({ path: `${dir}-collection.png`, fullPage: true });
	await page.goto('/');
	await expect(page.locator('.fan img').first()).toBeVisible();
	await page.waitForLoadState('networkidle');
	await page.screenshot({ path: `${dir}-library.png`, fullPage: true });
});

test('an empty collection has no stack', async ({ page }) => {
	await mockNetwork(page);
	await page.goto('/c/new');
	await page.getByLabel('Nome da coleção').fill('Vazia');
	await page.getByRole('button', { name: 'Criar coleção' }).click();
	await expect(page.getByRole('heading', { name: 'Vazia' })).toBeVisible();
	await expect(page.locator('.stack')).toHaveCount(0);
});

test('reduced motion: the fan keeps its pose but nothing animates', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await seed(page);
	await page.goto('/');
	const paper = page.locator('a.card[data-collection="todos"] .fan .left');
	// A global reduced-motion rule may set 1e-5s instead of 0s; both mean "instant".
	const seconds = await paper.evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration));
	expect(seconds).toBeLessThan(0.001);
	const before = await paper.evaluate((el) => getComputedStyle(el).transform);
	await page.locator('a.card[data-collection="todos"]').hover();
	expect(await paper.evaluate((el) => getComputedStyle(el).transform)).toBe(before);
});

test('without reduced motion, hovering a card fans the papers wider', async ({ page }, testInfo) => {
	test.skip(testInfo.project.name !== 'desktop', 'hover needs a pointer');
	await seed(page);
	await page.goto('/');
	const paper = page.locator('a.card[data-collection="todos"] .fan .left');
	const before = await paper.evaluate((el) => getComputedStyle(el).transform);
	await page.locator('a.card[data-collection="todos"]').hover();
	await expect
		.poll(() => paper.evaluate((el) => getComputedStyle(el).transform))
		.not.toBe(before);
});

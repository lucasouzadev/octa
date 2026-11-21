import { expect, test } from '@playwright/test';
import { mockNetwork } from './e2e-helpers';

// R4.6 experiment (owner's iPhone, white fade at the top). Only the wiring can be proven here:
// what the iPhone draws under the status bar has to be judged on the device.
test.describe('R4.6 status bar experiment', () => {
	test('the installed app asks for a translucent status bar', async ({ page }) => {
		await mockNetwork(page);
		await page.goto('/');
		await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute('content', 'black-translucent');
	});

	test('the light flag follows the screen: white Library yes, blue add screen no', async ({ page }) => {
		await mockNetwork(page);
		await page.goto('/');
		await expect(page.locator('html')).toHaveAttribute('data-light', 'true');
		await page.goto('/add');
		await expect(page.locator('html')).toHaveAttribute('data-light', 'false');
	});

	test('the dark strip only exists when installed, never in a browser tab', async ({ page }) => {
		await mockNetwork(page);
		await page.goto('/');
		const strip = await page.evaluate(() => getComputedStyle(document.documentElement, '::before').content);
		expect(strip === 'none' || strip === 'normal').toBe(true);
	});
});

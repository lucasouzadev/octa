import { expect, test } from '@playwright/test';
import { mockNetwork } from './e2e-helpers';

// R4.6 (owner's iPhone, white fade at the top). The dark-strip experiment was replaced in round 5
// (R5.1): the layout now paints the page itself. What the iPhone draws has to be judged on the device.
test.describe('R4.6 status bar experiment', () => {
	test('the installed app asks for a translucent status bar', async ({ page }) => {
		await mockNetwork(page);
		await page.goto('/');
		await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute('content', 'black-translucent');
	});
});

import { expect, test } from '@playwright/test';
import { fakeYouTube, mockNetwork, paste } from './e2e-helpers';

// R7.3: the platform name is on the player screen once, not in the header and again under the picture.

test('the platform name appears once on the player screen', async ({ page }) => {
	await mockNetwork(page);
	await fakeYouTube(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await expect(page).toHaveURL(/\/v\//);
	await expect(page.locator('main.player .source')).toHaveText('YouTube');
	await expect(page.locator('main.player .origin .provider')).toHaveCount(0);
	// The original link stays reachable and named.
	await expect(page.getByRole('link', { name: 'Abrir no YouTube' })).toBeVisible();
});

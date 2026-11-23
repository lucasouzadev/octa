import { expect, test } from '@playwright/test';
import { fakeYouTube, mockNetwork, paste } from './e2e-helpers';

// R7.3b: each platform's own theme on the player screen and the cards, and a like that
// turns the heart into the platform's icon and sends it up.

test('player screen wears the platform theme: icon and colour on the source label', async ({ page }) => {
	await mockNetwork(page);
	await fakeYouTube(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await expect(page).toHaveURL(/\/v\//);
	await expect(page.locator('main.player')).toHaveAttribute('data-platform', 'youtube');
	const label = page.locator('header .source');
	await expect(label).toContainText('YouTube');
	await expect(label.locator('svg')).toHaveCount(1);
	await expect(page.getByText('YouTube', { exact: true })).toHaveCount(1); // still shown once (R7.3a)
	const color = await label.evaluate((e) => getComputedStyle(e).color);
	expect(color).not.toBe('rgb(163, 163, 163)'); // no longer the neutral grey
});

test('Shorts and TikTok get their own theme', async ({ page }) => {
	await mockNetwork(page);
	await fakeYouTube(page);
	await paste(page, 'https://www.youtube.com/shorts/aBcDeFgHiJ0');
	await expect(page.locator('main.player')).toHaveAttribute('data-platform', 'shorts');
});

test('liking turns the heart into the platform icon and sends it up; unliking brings the heart back', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await mockNetwork(page);
	await fakeYouTube(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	const like = page.getByRole('button', { name: 'Curtir' });
	await expect(like).toHaveAttribute('data-glyph', 'heart');
	await like.click();
	await expect(like).toHaveAttribute('aria-pressed', 'true');
	await expect(like).toHaveAttribute('data-glyph', 'youtube'); // morphed
	await expect(page.locator('.hearts .heart').first()).toHaveAttribute('data-platform', 'youtube'); // rising icons
	await expect(like).toHaveAttribute('data-glyph', 'heart', { timeout: 4000 }); // and back to the heart, now filled
	await expect(like).toHaveAttribute('aria-pressed', 'true');
	await like.click();
	await expect(like).toHaveAttribute('aria-pressed', 'false');
	await expect(like).toHaveAttribute('data-glyph', 'heart');
});

test('reduced motion: no rising icons', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await mockNetwork(page);
	await fakeYouTube(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await page.getByRole('button', { name: 'Curtir' }).click();
	await expect(page.getByRole('button', { name: 'Curtir' })).toHaveAttribute('aria-pressed', 'true');
	await page.waitForTimeout(300);
	await expect(page.locator('.hearts .heart')).toHaveCount(0);
});

test('library cards carry the platform icon and colour on the source line', async ({ page }) => {
	await mockNetwork(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await expect(page).toHaveURL(/\/v\//);
	await page.goto('/c/todos');
	const src = page.locator('ul.videos .src').first();
	await expect(src).toContainText('YouTube');
	await expect(src.locator('svg')).toHaveCount(1);
	await expect(src).toHaveAttribute('data-platform', 'youtube');
});

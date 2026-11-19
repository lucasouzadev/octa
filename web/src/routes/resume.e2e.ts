import { expect, test, type Page } from '@playwright/test';
import { fakeYouTube, mockNetwork, paste, patchVideo, readVideo } from './e2e-helpers';

// Slice 3b: "Continuar assistindo". The player remembers where the person stopped.

async function open(page: Page) {
	await mockNetwork(page);
	await fakeYouTube(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await expect(page).toHaveURL(/\/v\//);
}

const options = (page: Page) =>
	page.evaluate(
		() => (window as unknown as { __yt: { options: { playerVars: Record<string, number> } } }).__yt.options.playerVars
	);

test('stopping saves the position; opening the video again shows it and starts there', async ({ page }) => {
	await open(page);
	await page.getByRole('button', { name: /^Assistir/ }).click();
	await expect(page.locator('.player iframe')).toHaveCount(1);
	await page.getByLabel('Posição no vídeo').fill('83');
	await page.getByRole('button', { name: 'Pausar' }).click();
	await expect.poll(async () => (await readVideo(page)).positionSec).toBe(83);
	expect((await readVideo(page)).durationSec).toBe(212); // learned from the player

	await page.reload();
	await expect(page.getByText('1:23')).toBeVisible(); // the bar shows it before the tap
	await page.getByRole('button', { name: /^Assistir/ }).click();
	await expect(page.locator('.player iframe')).toHaveCount(1);
	expect((await options(page)).start).toBe(83);
});

test('leaving the screen is a stop too, and it saves for the video that was playing', async ({ page }) => {
	await open(page);
	await page.getByRole('button', { name: /^Assistir/ }).click();
	await expect(page.locator('.player iframe')).toHaveCount(1);
	await page.getByLabel('Posição no vídeo').fill('120');
	await page.getByRole('link', { name: 'Fechar' }).click();
	await expect(page).toHaveURL(/\/$/);
	await expect.poll(async () => (await readVideo(page)).positionSec).toBe(120);
});

test('finishing the video clears the position, so it starts from the beginning', async ({ page }) => {
	await open(page);
	await patchVideo(page, { positionSec: 90, durationSec: 212 });
	await page.reload();
	await page.getByRole('button', { name: /^Assistir/ }).click();
	await expect(page.locator('.player iframe')).toHaveCount(1);
	expect((await options(page)).start).toBe(90);
	await page.evaluate(() => (window as unknown as { __yt: { end: () => void } }).__yt.end());
	await expect.poll(async () => (await readVideo(page)).positionSec).toBeUndefined();
	await page.reload();
	await page.getByRole('button', { name: /^Assistir/ }).click();
	await expect(page.locator('.player iframe')).toHaveCount(1);
	expect((await options(page)).start ?? 0).toBe(0);
});

test('a few seconds in is not worth a resume', async ({ page }) => {
	await open(page);
	await patchVideo(page, { positionSec: 4, durationSec: 212 });
	await page.reload();
	await expect(page.getByText('0:04')).toHaveCount(0);
	await page.getByRole('button', { name: /^Assistir/ }).click();
	await expect(page.locator('.player iframe')).toHaveCount(1);
	expect((await options(page)).start ?? 0).toBe(0);
});

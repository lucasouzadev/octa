import { expect, test, type Page } from '@playwright/test';
import { fakeYouTube, mockNetwork, paste, patchVideo, readVideo } from './e2e-helpers';

// Slice 3b: "Continuar assistindo". The platform's own player is on screen (R7.2), so the
// position comes from its API: the test imitates what the platform reports.

async function open(page: Page) {
	await mockNetwork(page);
	await fakeYouTube(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await expect(page).toHaveURL(/\/v\//);
	await expect(page.locator('.player iframe')).toHaveCount(1);
}

type YT = { at: (s: number) => void; state: (n: number) => void; end: () => void };
const yt = <K extends keyof YT>(page: Page, fn: K, arg?: number) =>
	page.evaluate(([f, a]) => (window as unknown as { __yt: Record<string, (n?: number) => void> }).__yt[f as string](a as number), [fn, arg] as const);

const options = (page: Page) =>
	page.evaluate(
		() => (window as unknown as { __yt: { options: { playerVars: Record<string, number> } } }).__yt.options.playerVars
	);

test('pausing saves the position; opening the video again starts there, with no cover', async ({ page }) => {
	await open(page);
	await yt(page, 'state', 1);
	await yt(page, 'at', 83);
	await yt(page, 'state', 2);
	await expect.poll(async () => (await readVideo(page)).positionSec).toBe(83);
	expect((await readVideo(page)).durationSec).toBe(212); // learned from the player

	await page.reload();
	await expect(page.locator('.player iframe')).toHaveCount(1);
	await expect(page.locator('.cover')).toHaveCount(0);
	expect((await options(page)).start).toBe(83);
});

test('leaving the screen is a stop too, and it saves for the video that was playing', async ({ page }) => {
	await open(page);
	await yt(page, 'state', 1);
	await yt(page, 'at', 120);
	await page.getByRole('link', { name: 'Fechar' }).click();
	await expect(page).toHaveURL(/\/$/);
	await expect.poll(async () => (await readVideo(page)).positionSec).toBe(120);
});

test('finishing the video clears the position, so it starts from the beginning', async ({ page }) => {
	await open(page);
	await patchVideo(page, { positionSec: 90, durationSec: 212 });
	await page.reload();
	await expect(page.locator('.player iframe')).toHaveCount(1);
	expect((await options(page)).start).toBe(90);
	await yt(page, 'end');
	await expect.poll(async () => (await readVideo(page)).positionSec).toBeUndefined();
	await page.reload();
	await expect(page.locator('.player iframe')).toHaveCount(1);
	expect((await options(page)).start ?? 0).toBe(0);
});

test('a few seconds in is not worth a resume', async ({ page }) => {
	await open(page);
	await patchVideo(page, { positionSec: 4, durationSec: 212 });
	await page.reload();
	await expect(page.locator('.player iframe')).toHaveCount(1);
	expect((await options(page)).start ?? 0).toBe(0);
});

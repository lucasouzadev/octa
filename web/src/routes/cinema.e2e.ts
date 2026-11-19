import { expect, test, type Page } from '@playwright/test';
import { fakeYouTube, mockNetwork, paste } from './e2e-helpers';

// Slice 3c: the personal cinema. One look for every source: the cover first, the
// platform player only after a tap, our one control bar below the picture, and the
// provider with the original link under it.

async function tiktokNet(page: Page) {
	await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
	await page.route('**/api/v1/resolve', (route) => route.fulfill({ status: 502, body: '' }));
}

test('YouTube: cover first, then the player without its controls, driven by our bar', async ({ page }, testInfo) => {
	await mockNetwork(page);
	await fakeYouTube(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ?t=42');
	await expect(page).toHaveURL(/\/v\//);
	await expect(page.locator('.player iframe')).toHaveCount(0);
	await page.waitForTimeout(900); // let the screen cross-fade settle
	await page.screenshot({ path: `test-results/cinema/${testInfo.project.name}-cover.png` });

	await page.getByRole('button', { name: /^Assistir/ }).click();
	await expect(page.locator('.player iframe')).toHaveCount(1);
	const opts = await page.evaluate(() => (window as unknown as { __yt: { options: { videoId: string; host: string; playerVars: Record<string, number> } } }).__yt.options);
	expect(opts.videoId).toBe('dQw4w9WgXcQ');
	expect(opts.host).toBe('https://www.youtube-nocookie.com');
	expect(opts.playerVars.controls).toBe(0);
	expect(opts.playerVars.start).toBe(42);
	await expect(page.locator('.player iframe')).toHaveAttribute('title', 'Sessão ao vivo no terraço');

	const calls = () => page.evaluate(() => (window as unknown as { __yt: { calls: string[] } }).__yt.calls);
	await expect.poll(calls).toContain('play'); // the tap on the cover starts it
	await page.getByRole('button', { name: 'Pausar' }).click();
	await expect.poll(calls).toContain('pause');
	await expect(page.getByRole('button', { name: 'Reproduzir' })).toBeVisible();
	await expect(page.getByText('3:32')).toBeVisible(); // duration from the player

	await page.getByLabel('Posição no vídeo').fill('100');
	await expect.poll(calls).toContain('seek:100');
	await expect(page.getByText('1:40')).toBeVisible();

	// The end of the video marks it watched, as with native files.
	await page.evaluate(() => (window as unknown as { __yt: { end: () => void } }).__yt.end());
	await page.getByRole('button', { name: 'Mais ações' }).click();
	await expect(page.getByRole('button', { name: 'Desmarcar como assistido' })).toBeVisible();
});

test('under the picture: the provider and the original link, which opens outside', async ({ page }) => {
	await mockNetwork(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	const origin = page.getByRole('link', { name: 'Abrir no YouTube' });
	await expect(origin).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
	await expect(origin).toHaveAttribute('target', '_blank');
	await expect(origin).toHaveAttribute('rel', /noopener/);
	await expect(origin).toContainText('youtube.com/watch?v=dQw4w9WgXcQ');
	// The control bar sits below the picture, never over it.
	const frame = (await page.locator('.player .frame').boundingBox())!;
	const bar = (await page.getByRole('group', { name: 'Controles do vídeo' }).boundingBox())!;
	expect(bar.y).toBeGreaterThanOrEqual(frame.y + frame.height - 1);
});

test('TikTok: player v1 without chrome; our bar follows its messages, only from TikTok', async ({ page }) => {
	await tiktokNet(page);
	await paste(page, 'https://www.tiktok.com/@u/video/7234567890123456789');
	await page.getByRole('button', { name: /^Assistir/ }).click();
	const frame = page.locator('.player iframe');
	await expect(frame).toHaveAttribute('src', /player\/v1\/7234567890123456789\?controls=0/);

	const send = (data: object, origin = 'https://www.tiktok.com') =>
		page.evaluate(
			([d, o]) => {
				const f = document.querySelector<HTMLIFrameElement>('.player iframe')!;
				window.dispatchEvent(new MessageEvent('message', { data: d, origin: o as string, source: f.contentWindow }));
			},
			[data, origin] as const
		);
	await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible(); // loading after the tap
	await send({ 'x-tiktok-player': true, type: 'onStateChange', value: 2 }, 'https://evil.example');
	await page.waitForTimeout(200);
	await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible(); // a foreign origin is ignored
	await send({ 'x-tiktok-player': true, type: 'onStateChange', value: 2 });
	await expect(page.getByRole('button', { name: 'Reproduzir' })).toBeVisible();
	await send({ 'x-tiktok-player': true, type: 'onStateChange', value: 1 });
	await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible();
	await send({ 'x-tiktok-player': true, type: 'onCurrentTime', value: { currentTime: 3, duration: 20 } });
	await expect(page.getByText('0:03')).toBeVisible();
	await expect(page.getByText('0:20')).toBeVisible();
});

test('Instagram keeps its own player: no bar of ours, the original link stays', async ({ page }) => {
	await tiktokNet(page);
	await paste(page, 'https://www.instagram.com/reel/Cxyz123/');
	await expect(page.getByRole('group', { name: 'Controles do vídeo' })).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Abrir no Reels' })).toHaveAttribute('href', 'https://www.instagram.com/reel/Cxyz123/');
});

test('a direct file plays in our bar, with no browser controls on the video', async ({ page }) => {
	await mockNetwork(page, { apiDown: true });
	await paste(page, 'https://cdn.example.com/media/Ensaio%20aberto.mp4');
	await expect(page.locator('.player video')).toHaveCount(1);
	await expect(page.locator('.player video')).not.toHaveAttribute('controls', /.*/);
	await expect(page.getByRole('button', { name: /^Assistir/ })).toHaveCount(0);
	await expect(page.getByRole('group', { name: 'Controles do vídeo' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Abrir no Arquivo' })).toBeVisible();
});

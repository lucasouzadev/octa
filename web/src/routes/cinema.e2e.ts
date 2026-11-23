import { expect, test, type Page } from '@playwright/test';
import { fakeYouTube, mockNetwork, paste, patchVideo, readVideo } from './e2e-helpers';

// R7.2: the player is the platform's own. No cover, no big play, no bar of ours, no
// fullscreen of ours: the picture is there at once and the platform's controls run it.
// What stays on our side: the original link, resume and "assistido" (through the platform API).

async function tiktokNet(page: Page) {
	await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
	await page.route('**/api/v1/resolve', (route) => route.fulfill({ status: 502, body: '' }));
}

async function noOwnChrome(page: Page) {
	await expect(page.locator('.cover')).toHaveCount(0);
	await expect(page.getByRole('group', { name: 'Controles do vídeo' })).toHaveCount(0);
	for (const name of [/^Assistir/, /^Continuar de/, 'Reproduzir', 'Pausar', 'Tela cheia', 'Sair da tela cheia'])
		await expect(page.locator('.player').getByRole('button', { name })).toHaveCount(0);
}

test('YouTube: the platform player is there at once, with its own controls and fullscreen', async ({ page }, testInfo) => {
	await mockNetwork(page);
	await fakeYouTube(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ?t=42');
	await expect(page).toHaveURL(/\/v\//);
	await expect(page.locator('.player iframe')).toHaveCount(1);
	await noOwnChrome(page);
	const opts = await page.evaluate(() => (window as unknown as { __yt: { options: { videoId: string; host: string; playerVars: Record<string, number> } } }).__yt.options);
	expect(opts.videoId).toBe('dQw4w9WgXcQ');
	expect(opts.host).toBe('https://www.youtube-nocookie.com');
	expect(opts.playerVars.controls).toBe(1); // the platform's own bar
	expect(opts.playerVars.fs).toBe(1); // and its own fullscreen
	expect(opts.playerVars.start).toBe(42);
	await expect(page.locator('.player iframe')).toHaveAttribute('title', 'Sessão ao vivo no terraço');
	await expect(page.locator('.player iframe')).toHaveAttribute('allow', /fullscreen/);
	await expect(page.locator('.player iframe')).toHaveAttribute('allowfullscreen', /.*/);
	await expect(page.locator('.player iframe')).not.toHaveCSS('pointer-events', 'none'); // touches reach the platform
	await page.waitForTimeout(900);
	await page.screenshot({ path: `test-results/cinema/${testInfo.project.name}-native.png` });

	// The end of the video marks it watched, as with native files.
	await page.evaluate(() => (window as unknown as { __yt: { end: () => void } }).__yt.end());
	await page.getByRole('button', { name: 'Mais ações' }).click();
	await expect(page.getByRole('button', { name: 'Desmarcar como assistido' })).toBeVisible();
});

test('YouTube: watching is saved from the platform API, with no control of ours', async ({ page }) => {
	await mockNetwork(page);
	await fakeYouTube(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await expect(page.locator('.player iframe')).toHaveCount(1);
	await page.evaluate(() => {
		const y = (window as unknown as { __yt: { at: (s: number) => void; state: (n: number) => void } }).__yt;
		y.state(1);
		y.at(75);
		y.state(2);
	});
	await expect.poll(async () => (await readVideo(page)).positionSec).toBe(75);
});

test('under the picture: the provider and the original link, which opens outside', async ({ page }) => {
	await mockNetwork(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	const origin = page.getByRole('link', { name: 'Abrir no YouTube' });
	await expect(origin).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
	await expect(origin).toHaveAttribute('target', '_blank');
	await expect(origin).toHaveAttribute('rel', /noopener/);
	await expect(origin).toContainText('youtube.com/watch?v=dQw4w9WgXcQ');
	const frame = (await page.locator('.player .frame').boundingBox())!;
	const link = (await origin.boundingBox())!;
	expect(link.y).toBeGreaterThanOrEqual(frame.y + frame.height - 1); // below the picture, never over it
});

test('TikTok: its own player v1 with its own controls; progress still reaches us, only from TikTok', async ({ page }) => {
	await tiktokNet(page);
	await paste(page, 'https://www.tiktok.com/@u/video/7234567890123456789');
	const frame = page.locator('.player iframe');
	await expect(frame).toHaveCount(1);
	await expect(frame).toHaveAttribute('src', /player\/v1\/7234567890123456789$/); // no hide-chrome params
	await expect(frame).toHaveAttribute('allow', /fullscreen/);
	await expect(frame).toHaveAttribute('allowfullscreen', /.*/);
	await noOwnChrome(page);
	await expect(page).toHaveURL(/\/v\//);

	const send = (data: object, origin = 'https://www.tiktok.com') =>
		page.evaluate(
			([d, o]) => {
				const f = document.querySelector<HTMLIFrameElement>('.player iframe')!;
				window.dispatchEvent(new MessageEvent('message', { data: d, origin: o as string, source: f.contentWindow }));
			},
			[data, origin] as const
		);
	await send({ 'x-tiktok-player': true, type: 'onCurrentTime', value: { currentTime: 9, duration: 20 } }, 'https://evil.example');
	await page.waitForTimeout(200);
	expect((await readVideo(page)).durationSec).toBeUndefined(); // a foreign origin is ignored
	await send({ 'x-tiktok-player': true, type: 'onCurrentTime', value: { currentTime: 12, duration: 20 } });
	await send({ 'x-tiktok-player': true, type: 'onStateChange', value: 2 });
	await expect.poll(async () => (await readVideo(page)).durationSec).toBe(20);
});

test('Instagram: a pure embed, the original link stays', async ({ page }) => {
	await tiktokNet(page);
	await paste(page, 'https://www.instagram.com/reel/Cxyz123/');
	await expect(page.locator('.player iframe')).toHaveAttribute('allow', /fullscreen/);
	await noOwnChrome(page);
	await expect(page.getByRole('link', { name: 'Abrir no Reels' })).toHaveAttribute('href', 'https://www.instagram.com/reel/Cxyz123/');
});

test('a direct file uses the browser\'s own controls, and nothing of ours', async ({ page }) => {
	await mockNetwork(page, { apiDown: true });
	await paste(page, 'https://cdn.example.com/media/Ensaio%20aberto.mp4');
	await expect(page.locator('.player video')).toHaveCount(1);
	await expect(page.locator('.player video')).toHaveAttribute('controls', /.*/);
	await noOwnChrome(page);
	await expect(page.getByRole('link', { name: 'Abrir no Arquivo' })).toBeVisible();
});

test('vertical: the normal screen keeps every action in view, and there is no screen of ours to open', async ({ page }, testInfo) => {
	test.skip(testInfo.project.name !== 'phone', 'phone layout');
	await mockNetwork(page);
	await fakeYouTube(page);
	await paste(page, 'https://www.youtube.com/shorts/aBcDeFgHiJ0');
	await expect(page.locator('.player .frame.vertical')).toBeVisible();
	await expect(page.locator('.cinema.full')).toHaveCount(0);
	const vh = page.viewportSize()!.height;
	const actions = (await page.locator('.actions').boundingBox())!;
	expect(actions.y + actions.height).toBeLessThanOrEqual(vh); // nothing hidden below the fold
	await page.locator('.player .frame').click(); // a tap goes to the platform, ours does not react
	await expect(page.locator('.cinema.full')).toHaveCount(0);
	await expect(page.locator('.actions')).toBeVisible();
});

test('a half-watched video starts where it stopped, without a label of ours', async ({ page }) => {
	await mockNetwork(page);
	await fakeYouTube(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await expect(page).toHaveURL(/\/v\//); // saved before the test edits it
	await patchVideo(page, { positionSec: 83, durationSec: 212 });
	await page.reload();
	await expect(page.locator('.player iframe')).toHaveCount(1);
	await noOwnChrome(page);
	const start = await page.evaluate(() => (window as unknown as { __yt: { options: { playerVars: { start: number } } } }).__yt.options.playerVars.start);
	expect(start).toBe(83);
});

test('no play mark over the thumbnails of the other screens', async ({ page }) => {
	await mockNetwork(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await expect(page).toHaveURL(/\/v\//); // saved before leaving
	await page.goto('/c/todos');
	await expect(page.locator('ul.videos li').first()).toBeVisible();
	await expect(page.locator('ul.videos .play')).toHaveCount(0);
});

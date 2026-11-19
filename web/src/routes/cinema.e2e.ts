import { expect, test, type Page } from '@playwright/test';
import { fakeYouTube, mockNetwork, paste, patchVideo } from './e2e-helpers';

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
	// The platform player is already loaded UNDER the cover; there is one play, ours.
	await expect(page.locator('.player iframe')).toHaveCount(1);
	await expect(page.getByRole('button', { name: /^Assistir/ })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Reproduzir' })).toHaveCount(0); // no second play in the bar
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
	const frame = page.locator('.player iframe');
	await expect(frame).toHaveAttribute('src', /player\/v1\/7234567890123456789\?controls=0/); // loaded under the cover
	await page.getByRole('button', { name: /^Assistir/ }).click();

	const send = (data: object, origin = 'https://www.tiktok.com') =>
		page.evaluate(
			([d, o]) => {
				const f = document.querySelector<HTMLIFrameElement>('.player iframe')!;
				window.dispatchEvent(new MessageEvent('message', { data: d, origin: o as string, source: f.contentWindow }));
			},
			[data, origin] as const
		);
	await expect(page.locator('.cover .big-play.wait')).toBeVisible(); // loading after the tap
	await send({ 'x-tiktok-player': true, type: 'onStateChange', value: 1 }, 'https://evil.example');
	await page.waitForTimeout(200);
	await expect(page.locator('.cover')).toBeVisible(); // a foreign origin is ignored
	await send({ 'x-tiktok-player': true, type: 'onStateChange', value: 1 });
	await expect(page.locator('.cover')).toHaveCount(0); // playing: the cover is gone
	await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible();
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
	await expect(page.getByRole('button', { name: /^Assistir/ })).toBeVisible(); // the one big play, over the first frame
	await expect(page.getByRole('group', { name: 'Controles do vídeo' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Abrir no Arquivo' })).toBeVisible();
});

test('one tap starts the video: the cover goes away and nothing asks for a second play', async ({ page }) => {
	await mockNetwork(page);
	await fakeYouTube(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await expect(page.locator('.player iframe')).toHaveCount(1);
	await page.getByRole('button', { name: /^Assistir/ }).click();
	await expect(page.locator('.cover')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible();
	const calls = await page.evaluate(() => (window as unknown as { __yt: { calls: string[] } }).__yt.calls);
	expect(calls.filter((c) => c === 'play')).toHaveLength(1);
});

test('when iOS refuses to start it, our big play steps aside so the platform play is the only one', async ({ page }) => {
	await mockNetwork(page);
	await fakeYouTube(page);
	await page.addInitScript(() => ((window as unknown as { __ytBlock: boolean }).__ytBlock = true));
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await expect(page.locator('.player iframe')).toHaveCount(1);
	await page.getByRole('button', { name: /^Assistir/ }).click();
	await expect(page.locator('.cover')).toHaveCount(0, { timeout: 6000 });
	await expect(page.locator('.player iframe')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Reproduzir' })).toBeVisible(); // the bar now controls it
});

test('a half-watched video shows where it stopped on the big button', async ({ page }) => {
	await mockNetwork(page);
	await fakeYouTube(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await expect(page).toHaveURL(/\/v\//); // saved before the test edits it
	await patchVideo(page, { positionSec: 83, durationSec: 212 });
	await page.reload();
	await expect(page.locator('.cover .resume')).toHaveText('Continuar · 1:23');
	await expect(page.getByRole('button', { name: /^Continuar de 1:23/ })).toBeVisible();
});

test('vertical: the normal screen keeps every action in view; play opens our full screen', async ({ page }, testInfo) => {
	test.skip(testInfo.project.name !== 'phone', 'phone layout');
	await mockNetwork(page);
	await fakeYouTube(page);
	await paste(page, 'https://www.youtube.com/shorts/aBcDeFgHiJ0');
	await expect(page.locator('.player .frame.vertical')).toBeVisible();
	const vh = page.viewportSize()!.height;
	const actions = (await page.locator('.actions').boundingBox())!;
	expect(actions.y + actions.height).toBeLessThanOrEqual(vh); // nothing hidden below the fold

	await page.getByRole('button', { name: /^Assistir/ }).click();
	const full = page.locator('.cinema.full');
	await expect(full).toBeVisible();
	const box = (await full.boundingBox())!;
	expect(box.height).toBeGreaterThanOrEqual(vh - 1); // it takes the whole screen
	const frame = (await page.locator('.player .frame').boundingBox())!;
	expect(frame.height).toBeGreaterThan(vh * 0.6); // and the picture is big in it
	await expect(page.getByRole('group', { name: 'Controles do vídeo' })).toBeVisible(); // our bar stays, below the picture

	await page.getByRole('button', { name: 'Sair da tela cheia' }).click();
	await expect(page.locator('.cinema.full')).toHaveCount(0);
	await expect(page.locator('.actions')).toBeVisible();
});

test('horizontal: play stays in the normal screen; the Tela cheia button opens and closes ours', async ({ page }) => {
	await mockNetwork(page);
	await fakeYouTube(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await page.getByRole('button', { name: /^Assistir/ }).click();
	await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible();
	await expect(page.locator('.cinema.full')).toHaveCount(0);
	await page.getByRole('button', { name: 'Tela cheia' }).click();
	await expect(page.locator('.cinema.full')).toBeVisible();
	await page.getByRole('button', { name: 'Sair da tela cheia' }).click();
	await expect(page.locator('.cinema.full')).toHaveCount(0);
});

test('while it plays, touches stay on our side so the platform HUD does not pop up', async ({ page }) => {
	await mockNetwork(page);
	await fakeYouTube(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await page.getByRole('button', { name: /^Assistir/ }).click();
	await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible();
	await expect(page.locator('.player iframe')).toHaveCSS('pointer-events', 'none');
	const calls = () => page.evaluate(() => (window as unknown as { __yt: { calls: string[] } }).__yt.calls);
	await page.locator('.player .frame').click(); // a tap on the picture pauses, like a native player
	await expect.poll(calls).toContain('pause');
	await expect(page.getByRole('button', { name: 'Reproduzir' })).toBeVisible();
});

test('when the platform refuses to start, its own play stays tappable', async ({ page }) => {
	await mockNetwork(page);
	await fakeYouTube(page);
	await page.addInitScript(() => ((window as unknown as { __ytBlock: boolean }).__ytBlock = true));
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await page.getByRole('button', { name: /^Assistir/ }).click();
	await expect(page.locator('.cover')).toHaveCount(0, { timeout: 6000 });
	await expect(page.locator('.player iframe')).toHaveCSS('pointer-events', 'auto');
});

test('pause answers at once on our side even when the platform is slow', async ({ page }) => {
	await mockNetwork(page);
	await fakeYouTube(page);
	await page.addInitScript(() => ((window as unknown as { __ytLag: number }).__ytLag = 1500));
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await page.getByRole('button', { name: /^Assistir/ }).click();
	await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible();
	await page.getByRole('button', { name: 'Pausar' }).click();
	await expect(page.getByRole('button', { name: 'Reproduzir' })).toBeVisible({ timeout: 300 }); // before the 1.5 s answer
	await page.waitForTimeout(1800);
	await expect(page.getByRole('button', { name: 'Reproduzir' })).toBeVisible(); // and it stays paused after it
});

test('no play mark over the thumbnails of the other screens', async ({ page }) => {
	await mockNetwork(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await expect(page).toHaveURL(/\/v\//); // saved before leaving
	await page.goto('/c/todos');
	await expect(page.locator('ul.videos li').first()).toBeVisible();
	await expect(page.locator('ul.videos .play')).toHaveCount(0);
});

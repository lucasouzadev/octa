import { expect, test } from '@playwright/test';
import { fakeYouTube, mockNetwork, paste, fillField } from './e2e-helpers';

test('smoke: paste a YouTube link, land on the player, see it in the library', async ({ page }) => {
	await mockNetwork(page);
	await fakeYouTube(page);
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Nada aqui ainda.' })).toBeVisible();

	await page.getByRole('link', { name: 'Colar um link' }).click();
	await expect(page.getByRole('heading', { name: /Cole um link/ })).toBeVisible();
	await fillField(page.getByLabel('Link do vídeo'), 'https://youtu.be/dQw4w9WgXcQ');
	await page.getByRole('button', { name: 'Gerar player' }).click();

	await expect(page).toHaveURL(/\/v\/[0-9a-f-]{36}$/);
	await expect(page.getByRole('heading', { name: 'Sessão ao vivo no terraço' })).toBeVisible();
	// R7.2: the platform's own player is there at once, no cover of ours.
	await expect(page.locator('.player iframe')).toHaveCount(1);
	await expect(page.getByRole('button', { name: /^Assistir/ })).toHaveCount(0);

	await page.getByRole('link', { name: 'Fechar' }).click();
	await expect(page.getByRole('heading', { name: 'Todos' })).toBeVisible();
	await expect(page.locator('a[data-collection="todos"]')).toContainText('1 vídeo');
});

test('player has four actions in the owner\'s order and favorite persists', async ({ page }) => {
	await mockNetwork(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	const actions = page.locator('.actions button');
	await expect(actions).toHaveCount(4); // R1.4: Compartilhar, Mover, Curtir, Próximo

	const fav = page.getByRole('button', { name: 'Curtir' });
	await expect(fav).toHaveAttribute('aria-pressed', 'false');
	await fav.click();
	await expect(fav).toHaveAttribute('aria-pressed', 'true');
	await page.reload();
	await expect(page.getByRole('button', { name: 'Curtir' })).toHaveAttribute('aria-pressed', 'true');
});

test('a Shorts link plays vertical and "next" moves through the library', async ({ page }) => {
	await mockNetwork(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await expect(page).toHaveURL(/\/v\//);
	await paste(page, 'https://www.youtube.com/shorts/aBcDeFgHiJ0');
	await expect(page.getByRole('heading', { name: 'Três acordes que mudaram tudo' })).toBeVisible();
	await expect(page.locator('.frame.vertical')).toBeVisible();

	await expect(page.getByRole('navigation', { name: 'Linha do tempo' }).getByRole('link')).toHaveCount(2);
	await page.getByRole('button', { name: 'Próximo vídeo' }).click();
	await expect(page.getByRole('heading', { name: 'Sessão ao vivo no terraço' })).toBeVisible();
});

test('pasting the same video twice opens the existing one', async ({ page }) => {
	await mockNetwork(page);
	await paste(page, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=share');
	await expect(page).toHaveURL(/\/v\//);
	const first = page.url();
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await expect(page).toHaveURL(first);
	await page.goto('/');
	await expect(page.locator('a[data-collection="todos"]')).toContainText('1 vídeo');
});

test('unsupported and invalid links explain themselves and save nothing', async ({ page }) => {
	await mockNetwork(page);
	await paste(page, 'https://example.com/page');
	await expect(page.getByRole('alert')).toContainText('ainda não é suportado');
	await fillField(page.getByLabel('Link do vídeo'), 'isso não é link');
	await page.getByRole('button', { name: 'Gerar player' }).click();
	await expect(page.getByRole('alert')).toContainText('não parece um link');
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Nada aqui ainda.' })).toBeVisible();
});

test('paste screen names every supported source and no longer promises Reels/TikTok "soon"', async ({ page }) => {
	await mockNetwork(page);
	await page.goto('/add');
	await expect(page.getByText('chegam em breve')).toHaveCount(0);
	await expect(page.getByText(/Reels/).first()).toBeVisible();
	await expect(page.getByText(/TikTok/).first()).toBeVisible();
	await paste(page, 'https://example.com/page');
	await expect(page.getByRole('alert')).toContainText('Reels');
	await expect(page.getByRole('alert')).toContainText('TikTok');
});

test('TikTok short link with the API down says it could not check now, not "unsupported"', async ({ page }) => {
	await mockNetwork(page, { apiDown: true });
	await paste(page, 'https://vt.tiktok.com/ZSabc123/');
	const alert = page.getByRole('alert');
	await expect(alert).toContainText('Não consegui abrir o link curto do TikTok agora');
	await expect(alert).not.toContainText('ainda não é suportado');
	await expect(page.getByLabel('Link do vídeo')).toHaveValue('https://vt.tiktok.com/ZSabc123/');
});

test('API down: the link is still saved and playable from the client parser', async ({ page }) => {
	await mockNetwork(page, { apiDown: true });
	await fakeYouTube(page);
	await paste(page, 'https://www.youtube.com/shorts/aBcDeFgHiJ0');
	await expect(page).toHaveURL(/\/v\//);
	await expect(page.getByRole('heading', { name: 'Vídeo do YouTube' })).toBeVisible();
	await expect(page.locator('.player iframe')).toHaveAttribute('src', /embed\/aBcDeFgHiJ0/);
});

test('direct .mp4 plays in the native player', async ({ page }) => {
	await mockNetwork(page, { apiDown: true });
	await paste(page, 'https://cdn.example.com/media/Ensaio%20aberto.mp4');
	await expect(page.getByRole('heading', { name: 'Ensaio aberto' })).toBeVisible();
	await expect(page.locator('video')).toHaveAttribute('src', 'https://cdn.example.com/media/Ensaio%20aberto.mp4');
});

test('no horizontal overflow on any screen', async ({ page }) => {
	await mockNetwork(page);
	const noOverflow = async () =>
		expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
	await page.goto('/');
	await noOverflow();
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await expect(page).toHaveURL(/\/v\//);
	await noOverflow();
	await page.goto('/add');
	await noOverflow();
	await page.goto('/c/todos');
	await noOverflow();
	await page.goto('/c/new');
	await noOverflow();
});

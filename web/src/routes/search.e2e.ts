import { expect, test, type Page } from '@playwright/test';
import { mockNetwork, paste } from './e2e-helpers';

const SESSAO = 'Sessão ao vivo no terraço';
const ACORDES = 'Três acordes que mudaram tudo';

async function seedTwoVideos(page: Page) {
	await mockNetwork(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ'); // Sessão… by Casa Aberta
	await expect(page).toHaveURL(/\/v\//);
	await paste(page, 'https://www.youtube.com/shorts/aBcDeFgHiJ0'); // Três acordes… by Nota Solta
	await expect(page).toHaveURL(/\/v\//);
}

async function openSearch(page: Page) {
	await page.goto('/');
	await page.getByRole('button', { name: 'Buscar vídeos' }).click();
	const box = page.getByRole('searchbox', { name: 'Buscar vídeos' });
	await expect(box).toBeFocused();
	return box;
}

test('search ignores accents and case, finds by title and author, and opens the player', async ({ page }) => {
	await seedTwoVideos(page);
	const box = await openSearch(page);

	await box.fill('TRES acordes');
	await expect(page.getByRole('status')).toHaveText('1 resultado');
	const results = page.getByRole('list', { name: 'Resultados da busca' });
	await expect(results.getByRole('link')).toHaveCount(1);
	await expect(results.getByText(ACORDES)).toBeVisible();

	await box.fill('casa aberta'); // author only
	await expect(results.getByText(SESSAO)).toBeVisible();
	await expect(results.getByText(ACORDES)).toHaveCount(0);

	await results.getByRole('link').click();
	await expect(page).toHaveURL(/\/v\/[^?]+\?c=todos$/);
});

test('no match shows an empty state; clearing or cancelling brings the Library back', async ({ page }) => {
	await seedTwoVideos(page);
	const box = await openSearch(page);

	await box.fill('zzzz');
	await expect(page.getByRole('status')).toHaveText('Nenhum vídeo encontrado.');
	await expect(page.getByRole('heading', { name: 'Nada com “zzzz”.' })).toBeVisible();

	await box.fill('');
	await expect(page.locator('a.card[data-collection="todos"]')).toBeVisible();

	await box.fill('sessao');
	await page.getByRole('button', { name: 'Cancelar' }).click();
	await expect(page.getByRole('heading', { name: 'Minha coleção' })).toBeVisible();
	await page.getByRole('button', { name: 'Buscar vídeos' }).click();
	await expect(page.getByRole('searchbox', { name: 'Buscar vídeos' })).toHaveValue('');
});

test('Escape closes the search', async ({ page }) => {
	await seedTwoVideos(page);
	const box = await openSearch(page);
	await box.fill('sessao');
	await page.keyboard.press('Escape');
	await expect(page.getByRole('searchbox')).toHaveCount(0);
	await expect(page.getByRole('heading', { name: 'Minha coleção' })).toBeVisible();
});

test('search reaches videos that live inside a collection', async ({ page }) => {
	await seedTwoVideos(page);
	await page.goto('/c/new');
	await page.getByLabel('Nome da coleção').fill('Música');
	await page.getByRole('button', { name: 'Criar coleção' }).click();
	await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);

	await page.goto('/c/todos');
	await page.getByRole('button', { name: 'Editar' }).click();
	await page.getByRole('button', { name: `Mover “${ACORDES}”` }).click();
	const sheet = page.getByRole('dialog', { name: 'Mover para' });
	await sheet.getByRole('button', { name: 'Música' }).click();
	await expect(sheet).toBeHidden();

	const box = await openSearch(page);
	await box.fill('acordes');
	await expect(page.getByRole('list', { name: 'Resultados da busca' }).getByText(ACORDES)).toBeVisible();
});

test('search is disabled while the library is empty', async ({ page }) => {
	await mockNetwork(page);
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Nada aqui ainda.' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Buscar vídeos' })).toBeDisabled();
});

test('search screen has no horizontal overflow', async ({ page }) => {
	await seedTwoVideos(page);
	const box = await openSearch(page);
	await box.fill('a');
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth > document.documentElement.clientWidth
	);
	expect(overflow).toBe(false);
});

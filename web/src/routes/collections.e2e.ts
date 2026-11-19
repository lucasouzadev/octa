import { expect, test, type Page } from '@playwright/test';
import { mockNetwork, paste, fillField } from './e2e-helpers';

const SESSAO = 'Sessão ao vivo no terraço';
const ACORDES = 'Três acordes que mudaram tudo';

async function seedTwoVideos(page: Page) {
	await mockNetwork(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ'); // oldest
	await expect(page).toHaveURL(/\/v\//);
	await paste(page, 'https://www.youtube.com/shorts/aBcDeFgHiJ0'); // newest: first in Todos
	await expect(page).toHaveURL(/\/v\//);
}

// Match the card by its exact heading: a substring like "De" also matches "víDEos".
function cardOf(page: Page, name: string) {
	return page.locator('a.card').filter({ has: page.getByRole('heading', { name, exact: true }) });
}

async function createCollection(page: Page, name: string) {
	await page.goto('/c/new');
	await fillField(page.getByLabel('Nome da coleção'), name);
	await page.getByRole('button', { name: 'Criar coleção' }).click();
	await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
	await expect(page.getByRole('heading', { name })).toBeVisible();
}

async function moveInto(page: Page, title: string, collection: string) {
	await page.goto('/c/todos');
	await page.getByRole('button', { name: 'Editar' }).click();
	await page.getByRole('button', { name: `Mover “${title}”` }).click();
	const sheet = page.getByRole('dialog', { name: 'Mover para' });
	await expect(sheet).toBeVisible();
	await sheet.getByRole('button', { name: collection }).click();
	await expect(sheet).toBeHidden();
}

test('create a collection, move a video in, play it in sequence, survive a reload', async ({ page }) => {
	await seedTwoVideos(page);
	await page.goto('/');
	await page.getByRole('button', { name: 'Criar conteúdo' }).click();
	await page.getByRole('menuitem', { name: 'Nova coleção' }).click();
	await expect(page).toHaveURL(/\/c\/new$/);
	await fillField(page.getByLabel('Nome da coleção'), '  Música  ');
	await page.getByRole('button', { name: 'Criar coleção' }).click();

	await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
	const collectionUrl = page.url();
	await expect(page.getByRole('heading', { name: 'Música' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Nada aqui ainda.' })).toBeVisible();

	await moveInto(page, ACORDES, 'Música');

	await page.goto('/');
	await expect(cardOf(page, 'Música')).toContainText('1 vídeo');
	await expect(page.locator('a[data-collection="todos"]')).toContainText('2 vídeos');

	await page.goto(collectionUrl);
	await expect(page.getByRole('link', { name: new RegExp(ACORDES) })).toBeVisible();
	await expect(page.getByRole('link', { name: new RegExp(SESSAO) })).toHaveCount(0);
	await page.getByRole('link', { name: 'Assistir em sequência' }).click();
	await expect(page).toHaveURL(/\/v\/[0-9a-f-]{36}\?c=[0-9a-f-]{36}$/);
	await expect(page.getByRole('heading', { name: ACORDES })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Próximo vídeo' })).toBeDisabled(); // only one in the collection

	await page.reload();
	await expect(page.getByRole('heading', { name: ACORDES })).toBeVisible();
	await page.getByRole('link', { name: 'Fechar' }).click();
	await expect(page).toHaveURL(collectionUrl);
});

test('"next" follows the collection order, not the whole library', async ({ page }) => {
	await seedTwoVideos(page);
	await createCollection(page, 'Ordem');
	await moveInto(page, SESSAO, 'Ordem'); // first
	await moveInto(page, ACORDES, 'Ordem'); // second

	// Todos is newest first (ACORDES, SESSAO); the collection order is SESSAO then ACORDES.
	await page.goto('/');
	await cardOf(page, 'Ordem').click();
	await page.getByRole('link', { name: 'Assistir em sequência' }).click();
	await expect(page.getByRole('heading', { name: SESSAO })).toBeVisible();
	await page.getByRole('button', { name: 'Próximo vídeo' }).click();
	await expect(page.getByRole('heading', { name: ACORDES })).toBeVisible();
	await expect(page).toHaveURL(/\?c=[0-9a-f-]{36}$/); // still inside the collection
	await page.getByRole('button', { name: 'Próximo vídeo' }).click();
	await expect(page.getByRole('heading', { name: SESSAO })).toBeVisible(); // wraps
});

test('moving a video to another collection removes it from the first', async ({ page }) => {
	await seedTwoVideos(page);
	await createCollection(page, 'De');
	await createCollection(page, 'Para');
	await moveInto(page, SESSAO, 'De');
	await moveInto(page, SESSAO, 'Para');
	await page.goto('/');
	await expect(cardOf(page, 'De')).toContainText('0 vídeos');
	await expect(cardOf(page, 'Para')).toContainText('1 vídeo');
});

test('rename and delete a collection; its videos stay in Todos', async ({ page }) => {
	await seedTwoVideos(page);
	await createCollection(page, 'Receitas');
	await moveInto(page, SESSAO, 'Receitas');
	await page.goto('/');
	await cardOf(page, 'Receitas').click();

	await page.getByRole('button', { name: 'Editar' }).click();
	await page.getByRole('button', { name: 'Renomear' }).click();
	await page.getByLabel('Novo nome da coleção').fill('Culinária');
	await page.getByLabel('Novo nome da coleção').press('Enter');
	await expect(page.getByRole('heading', { name: 'Culinária' })).toBeVisible();

	await page.getByRole('button', { name: 'Excluir', exact: true }).click();
	await expect(page.getByRole('alertdialog')).toContainText('Os vídeos continuam em Todos');
	await page.getByRole('button', { name: 'Excluir coleção' }).click();
	await expect(page).toHaveURL(/\/$/);
	await expect(cardOf(page, 'Culinária')).toHaveCount(0);
	await expect(page.locator('a[data-collection="todos"]')).toContainText('2 vídeos');
});

test('collection names are validated: empty, reserved "Todos" and too long', async ({ page }) => {
	await page.goto('/c/new');
	await expect(page.getByRole('button', { name: 'Criar coleção' })).toBeDisabled();
	await fillField(page.getByLabel('Nome da coleção'), 'todos');
	await page.getByRole('button', { name: 'Criar coleção' }).click();
	await expect(page.getByRole('alert')).toContainText('Esse nome é reservado');
	await fillField(page.getByLabel('Nome da coleção'), 'a'.repeat(61));
	await page.getByRole('button', { name: 'Criar coleção' }).click();
	await expect(page.getByRole('alert')).toContainText('até 60');
});

test('a collection that does not exist explains itself', async ({ page }) => {
	await page.goto('/c/nao-existe');
	await expect(page.getByRole('heading', { name: 'Essa coleção não existe mais.' })).toBeVisible();
	await page.getByRole('link', { name: 'Voltar à biblioteca' }).click();
	await expect(page).toHaveURL(/\/$/);
});

test('Collection screen has at most three visible actions', async ({ page }) => {
	await seedTwoVideos(page);
	await page.goto('/c/todos');
	// back, Editar, Assistir em sequência (row links are content, not actions)
	await expect(page.getByRole('link', { name: 'Voltar' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Editar' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Assistir em sequência' })).toBeVisible();
	await expect(page.locator('main > header a, main > header button, footer a, footer button')).toHaveCount(3);
});

test('screenshots for review (3 viewports)', async ({ page }, testInfo) => {
	await seedTwoVideos(page);
	await createCollection(page, 'Música');
	await moveInto(page, ACORDES, 'Música');
	const dir = `test-results/slice2a/${testInfo.project.name}`;
	await page.goto('/');
	await expect(cardOf(page, 'Música')).toBeVisible();
	await page.screenshot({ path: `${dir}-library.png`, fullPage: true });
	await cardOf(page, 'Música').click();
	await expect(page.getByRole('link', { name: 'Assistir em sequência' })).toBeVisible();
	await page.screenshot({ path: `${dir}-collection.png`, fullPage: true });
	await page.goto('/c/todos');
	await page.getByRole('button', { name: 'Editar' }).click();
	await page.getByRole('button', { name: `Mover “${SESSAO}”` }).click();
	await expect(page.getByRole('dialog', { name: 'Mover para' })).toBeVisible();
	await page.screenshot({ path: `${dir}-move-sheet.png` });
});

import { expect, test, type Page } from '@playwright/test';
import { mockNetwork, paste } from './e2e-helpers';

// Organizar (sort sheet) and Reordenar (drag the handle). The pointer is the real one.

async function createCollection(page: Page, name: string) {
	await page.goto('/c/new');
	await page.getByLabel('Nome da coleção').fill(name);
	await page.getByRole('button', { name: 'Criar coleção' }).click();
	await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
}

async function seed(page: Page, names: string[]) {
	await mockNetwork(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await expect(page).toHaveURL(/\/v\//);
	for (const n of names) await createCollection(page, n);
	await page.goto('/');
	await expect(page.locator('[data-collection]')).toHaveCount(names.length + 1);
}

const names = (page: Page) => page.locator('[data-collection] .title').allInnerTexts();
const organize = (page: Page) => page.getByRole('button', { name: 'Organizar', exact: true });

async function openSheet(page: Page) {
	await organize(page).click();
	await expect(page.locator('dialog.sheet[data-state="open"]')).toBeVisible();
}

async function startReorder(page: Page) {
	await openSheet(page);
	await page.getByRole('button', { name: 'Reordenar coleções' }).click();
	await expect(page.getByRole('heading', { name: 'Reordenar' })).toBeVisible();
	// The sheet slides out first; the page is inert until the dialog is really closed.
	await expect(page.locator('dialog.sheet[open]')).toHaveCount(0);
}

const rows = (page: Page) => page.locator('li[data-mine] .rname');

test.describe('R5 organize the Library', () => {
	test('a new collection comes last: oldest first is the default order', async ({ page }) => {
		await seed(page, ['Beta', 'Alfa', 'Zulu']);
		expect(await names(page)).toEqual(['Todos', 'Beta', 'Alfa', 'Zulu']);
	});

	test('the sheet sorts A–Z with Todos in the mix, and the choice survives a reload', async ({ page }) => {
		await seed(page, ['Beta', 'Alfa', 'Zulu']);
		await openSheet(page);
		await page.getByRole('radio', { name: 'A–Z' }).click();
		await expect(page.getByRole('radio', { name: 'A–Z' })).toHaveAttribute('aria-checked', 'true');
		await page.keyboard.press('Escape');
		await expect.poll(() => names(page)).toEqual(['Alfa', 'Beta', 'Todos', 'Zulu']);
		await page.reload();
		await expect.poll(() => names(page)).toEqual(['Alfa', 'Beta', 'Todos', 'Zulu']);
	});

	test('with a single card there is nothing to sort', async ({ page }) => {
		await seed(page, []);
		await openSheet(page);
		await expect(page.getByRole('button', { name: 'Reordenar coleções' })).toHaveCount(0);
		await expect(page.getByRole('radiogroup')).toHaveCount(0);
	});

	test('Todos plus one collection already can be ordered (R6.1)', async ({ page }) => {
		await seed(page, ['Solo']);
		await openSheet(page);
		await expect(page.getByRole('radiogroup')).toHaveCount(1);
		await expect(page.getByRole('button', { name: 'Reordenar coleções' })).toBeVisible();
	});

	test('the arrow keys on the handle move a collection and it stays after a reload', async ({ page }) => {
		await seed(page, ['Beta', 'Alfa', 'Zulu']);
		await startReorder(page);
		expect(await rows(page).allInnerTexts()).toEqual(['Todos', 'Beta', 'Alfa', 'Zulu']);
		await page.getByRole('button', { name: 'Mover Zulu' }).focus();
		await page.keyboard.press('ArrowUp');
		await page.keyboard.press('ArrowUp');
		expect(await rows(page).allInnerTexts()).toEqual(['Todos', 'Zulu', 'Beta', 'Alfa']);
		await expect(page.getByRole('button', { name: 'Mover Zulu' })).toBeFocused();
		await page.getByRole('button', { name: 'Concluir' }).click();
		await expect(page.locator('p.toast.shown[role="status"]')).toHaveText('Ordem salva');
		await expect.poll(() => names(page)).toEqual(['Todos', 'Zulu', 'Beta', 'Alfa']);
		await page.reload();
		await expect.poll(() => names(page)).toEqual(['Todos', 'Zulu', 'Beta', 'Alfa']);
	});

	test('dragging a handle with the pointer reorders and saves', async ({ page }) => {
		await seed(page, ['Beta', 'Alfa', 'Zulu']);
		await startReorder(page);
		const handle = page.getByRole('button', { name: 'Mover Beta' });
		const from = (await handle.boundingBox())!;
		const target = (await page.getByRole('button', { name: 'Mover Zulu' }).boundingBox())!;
		await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
		await page.mouse.down();
		await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 20, { steps: 4 });
		await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2 + 10, { steps: 10 });
		await expect(page.locator('li.lifted')).toHaveCount(1);
		await page.mouse.up();
		await expect.poll(() => rows(page).allInnerTexts()).toEqual(['Todos', 'Alfa', 'Zulu', 'Beta']);
		await expect(page.locator('li.lifted')).toHaveCount(0);
		await page.getByRole('button', { name: 'Concluir' }).click();
		await page.reload();
		await expect.poll(() => names(page)).toEqual(['Todos', 'Alfa', 'Zulu', 'Beta']);
	});

	test('Todos has a handle like any collection and starts on top (R6.1)', async ({ page }) => {
		await seed(page, ['Beta', 'Alfa']);
		await startReorder(page);
		await expect(page.getByRole('button', { name: 'Mover Todos' })).toBeVisible();
		await expect(page.locator('li.rrow.fixed')).toHaveCount(0);
		expect(await rows(page).allInnerTexts()).toEqual(['Todos', 'Beta', 'Alfa']);
	});

	test('Todos moves down between collections and stays there after a reload (R6.1)', async ({ page }) => {
		await seed(page, ['Beta', 'Alfa']);
		await startReorder(page);
		await page.getByRole('button', { name: 'Mover Todos' }).focus();
		await page.keyboard.press('ArrowDown');
		expect(await rows(page).allInnerTexts()).toEqual(['Beta', 'Todos', 'Alfa']);
		await page.getByRole('button', { name: 'Concluir' }).click();
		await expect.poll(() => names(page)).toEqual(['Beta', 'Todos', 'Alfa']);
		await page.reload();
		await expect.poll(() => names(page)).toEqual(['Beta', 'Todos', 'Alfa']);
	});

	test('a collection can go above Todos by hand, and the choice is the saved order (R6.1)', async ({ page }) => {
		await seed(page, ['Beta', 'Alfa']);
		await startReorder(page);
		await page.getByRole('button', { name: 'Mover Alfa' }).focus();
		await page.keyboard.press('ArrowUp');
		await page.keyboard.press('ArrowUp');
		await page.getByRole('button', { name: 'Concluir' }).click();
		await page.reload();
		await expect.poll(() => names(page)).toEqual(['Alfa', 'Todos', 'Beta']);
	});

	test('Concluir leaves the mode; the header shows search, Organizar and +', async ({ page }) => {
		await seed(page, ['Beta', 'Alfa']);
		await expect(page.locator('header .icon-button')).toHaveCount(3);
		await startReorder(page);
		await page.getByRole('button', { name: 'Concluir' }).click();
		await expect(page.getByRole('heading', { name: 'Minha coleção' })).toBeVisible();
	});

	test('the Move sheet lists the collections in the person’s order', async ({ page }) => {
		await seed(page, ['Beta', 'Alfa']);
		await openSheet(page);
		await page.getByRole('radio', { name: 'A–Z' }).click();
		await page.keyboard.press('Escape');
		await expect(page.locator('dialog.sheet[open]')).toHaveCount(0);
		await page.locator('[data-collection="todos"]').click();
		await page.locator('a[href^="/v/"]').first().click();
		await page.getByRole('button', { name: 'Mover', exact: true }).click();
		const opts = page.locator('dialog.sheet[data-state="open"] .option');
		await expect(opts.first()).toHaveText(/Alfa/);
	});
});

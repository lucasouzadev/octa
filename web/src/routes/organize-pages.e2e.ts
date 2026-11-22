import { expect, test, type Page } from '@playwright/test';
import { mockNetwork, paste } from './e2e-helpers';

// R5.2: the "Organizar" sheet is for organizing. Exportar / Importar / "Mover com o celular"
// live on a second page of the same sheet, "Dados". Written red first.

async function open(page: Page) {
	await mockNetwork(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await expect(page).toHaveURL(/\/v\//);
	await page.goto('/');
	await page.getByRole('button', { name: 'Organizar', exact: true }).click();
}

const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });

test.describe('R5.2 the Organizar sheet has two pages', () => {
	test('opens on Organizar and keeps the data actions off that page', async ({ page }) => {
		await open(page);
		await expect(tab(page, 'Organizar')).toHaveAttribute('aria-selected', 'true');
		await expect(tab(page, 'Dados')).toHaveAttribute('aria-selected', 'false');
		await expect(page.getByRole('button', { name: 'Exportar biblioteca' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Importar arquivo' })).toHaveCount(0);
		await expect(page.getByRole('switch', { name: 'Mover com o celular' })).toHaveCount(0);
	});

	test('Dados holds export, import and the motion switch', async ({ page }) => {
		await open(page);
		await tab(page, 'Dados').click();
		await expect(tab(page, 'Dados')).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByRole('button', { name: 'Exportar biblioteca' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Importar arquivo' })).toBeVisible();
		await expect(page.getByLabel('Arquivo da biblioteca')).toHaveCount(1);
	});

	test('the sheet reopens on the Organizar page', async ({ page }) => {
		await open(page);
		await tab(page, 'Dados').click();
		await page.keyboard.press('Escape');
		await page.getByRole('button', { name: 'Organizar', exact: true }).click();
		await expect(tab(page, 'Organizar')).toHaveAttribute('aria-selected', 'true');
	});
});

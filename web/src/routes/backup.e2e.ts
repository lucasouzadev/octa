import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { mockNetwork, paste } from './e2e-helpers';

// Export / import from the Organizar sheet. The file is read and written for real.

const toast = (page: Page) => page.locator('p.toast.shown[role="status"]');

async function createCollection(page: Page, name: string) {
	await page.goto('/c/new');
	await page.getByLabel('Nome da coleção').fill(name);
	await page.getByRole('button', { name: 'Criar coleção' }).click();
	await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
}

async function openSheet(page: Page) {
	await page.getByRole('button', { name: 'Organizar', exact: true }).click();
	await page.getByRole('tab', { name: 'Dados', exact: true }).click();
	await expect(page.locator('dialog.sheet[data-state="open"]')).toBeVisible();
}

// The share sheet is not what these tests are about: plain download everywhere.
async function download(page: Page) {
	await page.addInitScript(() => Object.defineProperty(navigator, 'canShare', { value: undefined }));
}

const file = (videos: object[], collections: object[], over: object = {}) =>
	JSON.stringify({ app: 'octa', schema: 1, exportedAt: '2026-11-20T00:00:00.000Z', videos, collections, ...over });

const video = (id: string, yt: string) => ({
	id,
	url: `https://youtu.be/${yt}`,
	canonicalUrl: `https://www.youtube.com/watch?v=${yt}`,
	title: `Importado ${id}`,
	health: 'alive',
	deadStreak: 0,
	favorite: true,
	createdAt: '2026-11-01T00:00:00.000Z',
	updatedAt: '2026-11-01T00:00:00.000Z'
});

async function importText(page: Page, text: string) {
	await openSheet(page);
	await page.getByLabel('Arquivo da biblioteca').setInputFiles({ name: 'octa.json', mimeType: 'application/json', buffer: Buffer.from(text) });
}

test.describe('R6 export and import', () => {
	test('exports a versioned JSON with the collections and their order', async ({ page }) => {
		await download(page);
		await mockNetwork(page);
		await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
		await expect(page).toHaveURL(/\/v\//);
		await createCollection(page, 'Beta');
		await createCollection(page, 'Alfa');
		await page.goto('/');
		await page.getByRole('button', { name: 'Organizar', exact: true }).click();
		await page.getByRole('radio', { name: 'A–Z' }).click();
		await page.getByRole('button', { name: 'Reordenar coleções' }).click();
		await expect(page.locator('dialog.sheet[open]')).toHaveCount(0);
		await page.getByRole('button', { name: 'Mover Alfa' }).focus();
		await page.keyboard.press('ArrowDown');
		await page.getByRole('button', { name: 'Concluir' }).click();
		await openSheet(page);
		const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar biblioteca' }).click()]);
		expect(dl.suggestedFilename()).toMatch(/^octa-\d{4}-\d{2}-\d{2}\.json$/);
		const data = JSON.parse(readFileSync((await dl.path())!, 'utf8'));
		expect(data).toMatchObject({ app: 'octa', schema: 1 });
		expect(data.videos).toHaveLength(1);
		expect(data.collections.map((c: { name: string; rank: number }) => [c.name, c.rank])).toEqual(expect.arrayContaining([['Beta', 0], ['Alfa', 1]]));
	});

	test('a file exported here restores the library in a fresh browser profile', async ({ page, browser }) => {
		await download(page);
		await mockNetwork(page);
		await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
		await expect(page).toHaveURL(/\/v\//);
		await createCollection(page, 'Aulas');
		await page.goto('/');
		await openSheet(page);
		const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar biblioteca' }).click()]);
		const text = readFileSync((await dl.path())!, 'utf8');

		const other = await browser.newContext({ viewport: page.viewportSize() ?? undefined });
		const p2 = await other.newPage();
		await mockNetwork(p2);
		await p2.goto('/');
		await importText(p2, text);
		await expect(toast(p2)).toHaveText('1 vídeo importado');
		await expect(p2.locator('[data-collection]')).toHaveCount(2);
		await expect(p2.locator('[data-collection] .title')).toHaveText(['Todos', 'Aulas']);
		await other.close();
	});

	test('importing the same file again adds nothing', async ({ page }) => {
		await mockNetwork(page);
		await page.goto('/');
		const text = file([video('a', 'dQw4w9WgXcQ')], []);
		await importText(page, text);
		await expect(toast(page)).toHaveText('1 vídeo importado');
		await expect(page.locator('dialog.sheet[open]')).toHaveCount(0);
		await importText(page, text);
		await expect(toast(page)).toHaveText('Nada novo para importar');
	});

	test('the Organizar button is there on an empty library, so a first import is possible', async ({ page }) => {
		await mockNetwork(page);
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Organizar', exact: true })).toBeVisible();
		await importText(page, file([video('a', 'dQw4w9WgXcQ'), video('b', 'abcdefghij1')], []));
		await expect(toast(page)).toHaveText('2 vídeos importados');
		await expect(page.locator('[data-collection="todos"]')).toBeVisible();
	});

	test('files that are not octa files are refused with a message and change nothing', async ({ page }) => {
		await mockNetwork(page);
		await page.goto('/');
		await importText(page, 'not json at all');
		await expect(toast(page)).toHaveText('Esse arquivo não é válido');
		await expect(page.locator('dialog.sheet[open]')).toHaveCount(0);
		await importText(page, JSON.stringify({ app: 'other', schema: 1, videos: [], collections: [] }));
		await expect(toast(page)).toHaveText('Esse arquivo não é do octa');
		await importText(page, file([], [], { schema: 99 }));
		await expect(toast(page)).toHaveText('Arquivo de uma versão mais nova do octa');
	});

	test('a hostile file cannot plant a foreign iframe: the player uses our embed', async ({ page }) => {
		await mockNetwork(page);
		await page.goto('/');
		const evil = { ...video('a', 'dQw4w9WgXcQ'), embed: { type: 'iframe', src: 'https://evil.example/x', aspect: '16:9' }, thumbnail: 'javascript:alert(1)' };
		await importText(page, file([evil, { ...video('b', 'abcdefghij1'), url: 'javascript:alert(1)', canonicalUrl: 'javascript:alert(1)' }], []));
		await expect(toast(page)).toHaveText('1 vídeo importado, 1 ignorado');
		// What was stored: our embed and no thumbnail, whatever the file said.
		const stored = await page.evaluate(
			() =>
				new Promise<{ embed: { src: string }; thumbnail?: string }>((resolve, reject) => {
					const open = indexedDB.open('octa');
					open.onerror = () => reject(open.error);
					open.onsuccess = () => {
						const get = open.result.transaction('videos').objectStore('videos').get('a');
						get.onsuccess = () => resolve(get.result);
						get.onerror = () => reject(get.error);
					};
				})
		);
		expect(stored.embed.src).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\//);
		expect(stored.thumbnail).toBeUndefined();
	});
});

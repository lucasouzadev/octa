import { expect, test, type Page } from '@playwright/test';
import { mockNetwork } from './e2e-helpers';

// QA round 6 (owner 2026-11-22): in Editar a tap on the card selects, it never opens the video;
// the "Mover para" sheet shows every selected cover, not only the first. Written red first.

interface Seed {
	title: string;
	source?: 'youtube' | 'tiktok' | 'direct';
}

/** Writes videos (newest = last in the list) and one collection holding `inCollection` of them. */
async function seedLibrary(page: Page, videos: Seed[], inCollection: number) {
	await mockNetwork(page);
	await page.goto('/'); // the app creates the database
	await page.evaluate(
		async ({ videos, inCollection }) => {
			// Wait for the app to create its database: opening it first would make an empty one.
			for (let i = 0; i < 100 && !(await indexedDB.databases()).some((d) => d.name === 'octa'); i++) {
				await new Promise((r) => setTimeout(r, 50));
			}
			const db = await new Promise<IDBDatabase>((resolve, reject) => {
				const open = indexedDB.open('octa');
				open.onerror = () => reject(open.error);
				open.onsuccess = () => resolve(open.result);
			});
			await new Promise<void>((resolve, reject) => {
				const tx = db.transaction(['videos', 'collections'], 'readwrite');
				const now = Date.now();
				const ids: string[] = [];
				videos.forEach((v, i) => {
					const code = `abcdefghi${String(i).padStart(2, '0')}`;
					const id = `00000000-0000-4000-8000-0000000000${String(i).padStart(2, '0')}`;
					ids.push(id);
					const at = new Date(now - (videos.length - i) * 60_000).toISOString();
					tx.objectStore('videos').put({
						id,
						url: `https://youtu.be/${code}`,
						canonicalUrl: `https://www.youtube.com/watch?v=${code}`,
						source: v.source ?? 'youtube',
						kind: 'video',
						embed: { type: 'iframe', src: `https://www.youtube-nocookie.com/embed/${code}`, aspect: '16:9' },
						title: v.title,
						thumbnail: `https://img.example/${code}.jpg`,
						health: 'alive',
						checkedAt: new Date().toISOString(),
						metaAt: new Date().toISOString(),
						deadStreak: 0,
						favorite: false,
						createdAt: at,
						updatedAt: at
					});
				});
				tx.objectStore('collections').put({
					id: 'aulas',
					name: 'Aulas',
					order: ids.slice(0, inCollection),
					createdAt: new Date(now - 3_600_000).toISOString(),
					updatedAt: new Date(now - 3_600_000).toISOString()
				});
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			});
			db.close(); // an open connection would block the app's next upgrade
		},
		{ videos, inCollection }
	);
}


async function edit(page: Page, path: string) {
	await page.goto(path);
	await page.getByRole('button', { name: 'Editar', exact: true }).click();
	await expect(page.locator('ul.videos.editing')).toBeVisible();
}

test.describe('R6.2 selection mode blocks the card', () => {
	test('tapping the card (not the button) selects it and stays on the collection', async ({ page }) => {
		await seedLibrary(page, [{ title: 'Um' }, { title: 'Dois' }], 2);
		await edit(page, '/c/aulas');
		await page.locator('ul.videos li').first().locator('a.row').click();
		await expect(page).toHaveURL(/\/c\/aulas$/);
		await expect(page.locator('ul.videos li.picked')).toHaveCount(1);
		await page.locator('ul.videos li').first().locator('a.row').click();
		await expect(page.locator('ul.videos li.picked')).toHaveCount(0);
	});

	test('outside Editar the card still opens the video', async ({ page }) => {
		await seedLibrary(page, [{ title: 'Um' }], 1);
		await page.goto('/c/aulas');
		await page.locator('ul.videos li').first().locator('a.row').click();
		await expect(page).toHaveURL(/\/v\//);
	});
});

test.describe('R6.3 Mover para shows the selected covers', () => {
	test('two selected videos show two covers in the sheet', async ({ page }) => {
		await seedLibrary(page, [{ title: 'Um' }, { title: 'Dois' }, { title: 'Três' }], 3);
		await edit(page, '/c/aulas');
		await page.getByRole('checkbox', { name: 'Selecionar “Um”' }).click();
		await page.getByRole('checkbox', { name: 'Selecionar “Dois”' }).click();
		await page.getByRole('button', { name: /^Mover 2 vídeos/ }).click();
		const sheet = page.getByRole('dialog', { name: 'Mover para' });
		await expect(sheet).toBeVisible();
		await expect(sheet.locator('.preview img')).toHaveCount(2);
	});

	test('a single video still shows its one cover', async ({ page }) => {
		await seedLibrary(page, [{ title: 'Um' }, { title: 'Dois' }], 2);
		await edit(page, '/c/aulas');
		await page.getByRole('button', { name: 'Mover “Um”' }).click();
		await expect(page.getByRole('dialog', { name: 'Mover para' }).locator('.preview img')).toHaveCount(1);
	});
});

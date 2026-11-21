import { expect, test, type Page } from '@playwright/test';
import { mockNetwork } from './e2e-helpers';

// R4.5: the owner found nothing to organize the videos inside a collection with: reorder them,
// sort them, move several at once. All of it lives in the collection's "Editar" mode.

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

/** Titles in the order the rows are drawn (read from each row's own button label). */
const titles = async (page: Page) =>
	(await page.locator('ul.videos li button[aria-label^="Editar “"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')!))).map((l) =>
		l.replace(/^Editar “/, '').replace(/”$/, '')
	);

async function edit(page: Page, path: string) {
	await page.goto(path);
	await page.getByRole('button', { name: 'Editar', exact: true }).click();
	await expect(page.locator('ul.videos.editing')).toBeVisible();
}

test.describe('R4.5 sort the videos of a collection', () => {
	const seed: Seed[] = [
		{ title: 'Charlie' },
		{ title: 'alfa', source: 'tiktok' },
		{ title: 'Bravo', source: 'direct' }
	];

	test('Título: A to Z, and it is the saved order after a reload', async ({ page }) => {
		await seedLibrary(page, seed, 3);
		await edit(page, '/c/aulas');
		expect(await titles(page)).toEqual(['Charlie', 'alfa', 'Bravo']);
		await page.getByRole('button', { name: 'Título', exact: true }).click();
		await expect.poll(() => titles(page)).toEqual(['alfa', 'Bravo', 'Charlie']);
		await page.reload();
		await page.getByRole('button', { name: 'Editar', exact: true }).click();
		expect(await titles(page)).toEqual(['alfa', 'Bravo', 'Charlie']);
	});

	test('Data puts the newest first', async ({ page }) => {
		await seedLibrary(page, seed, 3);
		await edit(page, '/c/aulas');
		await page.getByRole('button', { name: 'Data', exact: true }).click();
		await expect.poll(() => titles(page)).toEqual(['Bravo', 'alfa', 'Charlie']);
	});

	test('Origem groups by platform, newest first inside a platform', async ({ page }) => {
		await seedLibrary(page, [{ title: 'Zed' }, { title: 'Yan', source: 'tiktok' }, { title: 'Xia' }, { title: 'Wu', source: 'direct' }], 4);
		await edit(page, '/c/aulas');
		await page.getByRole('button', { name: 'Origem', exact: true }).click();
		// MP4, TikTok, then YouTube with the newer one (Xia) before Zed
		await expect.poll(() => titles(page)).toEqual(['Wu', 'Yan', 'Xia', 'Zed']);
	});

	test('the virtual screens (Todos) have nothing to sort or reorder', async ({ page }) => {
		await seedLibrary(page, seed, 3);
		await edit(page, '/c/todos');
		await expect(page.getByRole('button', { name: 'Título', exact: true })).toHaveCount(0);
		await expect(page.locator('button[aria-label^="Subir"]')).toHaveCount(0);
	});
});

test.describe('R4.5 reorder one video at a time', () => {
	const seed: Seed[] = [{ title: 'Um' }, { title: 'Dois' }, { title: 'Três' }];

	test('Descer and Subir move a video; the ends cannot go further; it persists', async ({ page }) => {
		await seedLibrary(page, seed, 3);
		await edit(page, '/c/aulas');
		await expect(page.getByRole('button', { name: 'Subir “Um”' })).toBeDisabled();
		await expect(page.getByRole('button', { name: 'Descer “Três”' })).toBeDisabled();
		await page.getByRole('button', { name: 'Descer “Um”' }).click();
		await expect.poll(() => titles(page)).toEqual(['Dois', 'Um', 'Três']);
		await page.getByRole('button', { name: 'Subir “Três”' }).click();
		await expect.poll(() => titles(page)).toEqual(['Dois', 'Três', 'Um']);
		await page.reload();
		await page.getByRole('button', { name: 'Editar', exact: true }).click();
		expect(await titles(page)).toEqual(['Dois', 'Três', 'Um']);
	});

	test('the play order follows: "Assistir em sequência" opens the first one', async ({ page }) => {
		await seedLibrary(page, seed, 3);
		await edit(page, '/c/aulas');
		await page.getByRole('button', { name: 'Descer “Um”' }).click();
		await expect.poll(() => titles(page)).toEqual(['Dois', 'Um', 'Três']);
		await page.getByRole('button', { name: 'Concluído' }).click();
		await page.getByRole('link', { name: 'Assistir em sequência' }).click();
		await expect(page.locator('.info h1')).toHaveText('Dois');
	});
});

test.describe('R4.5 move several videos at once', () => {
	const seed: Seed[] = [{ title: 'Um' }, { title: 'Dois' }, { title: 'Três' }];

	test('select two in Todos, Mover 2 vídeos, pick the collection', async ({ page }) => {
		await seedLibrary(page, seed, 0);
		await edit(page, '/c/todos');
		await expect(page.getByRole('button', { name: /^Mover \d/ })).toHaveCount(0);
		await page.getByRole('checkbox', { name: 'Selecionar “Um”' }).click();
		await page.getByRole('checkbox', { name: 'Selecionar “Três”' }).click();
		await expect(page.getByRole('checkbox', { name: 'Selecionar “Um”' })).toHaveAttribute('aria-checked', 'true');
		await page.getByRole('button', { name: 'Mover 2 vídeos' }).click();
		await page.getByRole('button', { name: 'Aulas', exact: true }).click();
		await expect(page.locator('p.toast.shown[role="status"]')).toHaveText('2 vídeos movidos para Aulas');
		await page.goto('/c/aulas');
		await page.getByRole('button', { name: 'Editar', exact: true }).click();
		expect((await titles(page)).sort()).toEqual(['Três', 'Um']);
	});

	test('the selection clears after the move and when Editar is closed', async ({ page }) => {
		await seedLibrary(page, seed, 0);
		await edit(page, '/c/todos');
		await page.getByRole('checkbox', { name: 'Selecionar “Dois”' }).click();
		await expect(page.getByRole('button', { name: 'Mover 1 vídeo' })).toBeVisible();
		await page.getByRole('button', { name: 'Concluído' }).click();
		await page.getByRole('button', { name: 'Editar', exact: true }).click();
		await expect(page.getByRole('button', { name: /^Mover \d/ })).toHaveCount(0);
	});

	test('one video can still be moved the old way', async ({ page }) => {
		await seedLibrary(page, seed, 0);
		await edit(page, '/c/todos');
		await page.getByRole('button', { name: 'Mover “Um”' }).click();
		await page.getByRole('button', { name: 'Aulas', exact: true }).click();
		await expect(page.locator('p.toast.shown[role="status"]')).toHaveText('Movido para Aulas');
	});
});

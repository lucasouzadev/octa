import { expect, test, type Page } from '@playwright/test';
import { mockNetwork } from './e2e-helpers';

// R5.2 part B: the videos of a collection can be dragged by a handle (pointer events), like the
// collections on the Library. Written red first: it must fail before the handle exists.

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

const center = async (page: Page, name: string) => {
	const b = (await page.getByRole('button', { name }).boundingBox())!;
	return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

// R5.2 follow-up (owner 2026-11-22): the order each collection is sorted by is remembered on this
// device, per collection. Written red first: the chip must stay pressed after a new visit.

test.describe('R5.2 the collection remembers its video sort, per collection', () => {
	test('sorting by name, then coming back, shows "Título" still chosen', async ({ page }) => {
		await seedLibrary(page, [{ title: 'Um' }, { title: 'Dois' }, { title: 'Três' }], 3);
		await edit(page, '/c/aulas');
		const group = page.getByRole('group', { name: 'Ordenar vídeos por' });
		await group.getByRole('button', { name: 'Título', exact: true }).click();
		await expect(group.getByRole('button', { name: 'Título', exact: true })).toHaveAttribute('aria-pressed', 'true');
		await page.reload();
		await edit(page, '/c/aulas');
		await expect(page.getByRole('group', { name: 'Ordenar vídeos por' }).getByRole('button', { name: 'Título', exact: true })).toHaveAttribute('aria-pressed', 'true');
		await expect(page.getByRole('group', { name: 'Ordenar vídeos por' }).getByRole('button', { name: 'Data', exact: true })).toHaveAttribute('aria-pressed', 'false');
	});

	test('a choice in one collection does not change another', async ({ page }) => {
		await seedLibrary(page, [{ title: 'Um' }, { title: 'Dois' }], 2);
		await page.evaluate(() => localStorage.setItem('octa.vsort.outra', 'title'));
		await edit(page, '/c/aulas');
		const group = page.getByRole('group', { name: 'Ordenar vídeos por' });
		await expect(group.getByRole('button', { name: 'Título', exact: true })).toHaveAttribute('aria-pressed', 'false');
		await expect(group.getByRole('button', { name: 'Data', exact: true })).toHaveAttribute('aria-pressed', 'false');
	});

	test('the order is still written on the press, not on the next visit', async ({ page }) => {
		await seedLibrary(page, [{ title: 'Um' }, { title: 'Dois' }, { title: 'Três' }], 3);
		await edit(page, '/c/aulas');
		await page.getByRole('group', { name: 'Ordenar vídeos por' }).getByRole('button', { name: 'Título', exact: true }).click();
		await expect(page.getByRole('status').filter({ hasText: 'Ordenado por título' })).toBeVisible();
		await page.reload();
		await edit(page, '/c/aulas');
		const shown = await page.locator('ul.videos li button[aria-label^="Editar “"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')!.replace(/^Editar “/, '').replace(/”$/, '')));
		expect(shown).toEqual(['Dois', 'Três', 'Um']);
	});
});

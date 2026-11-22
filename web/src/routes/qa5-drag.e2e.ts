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

test.describe('R5.2 drag a video by its handle inside a collection', () => {
	const seed: Seed[] = [{ title: 'Um' }, { title: 'Dois' }, { title: 'Três' }];

	test('dragging the handle of the first video past the last reorders it and it persists', async ({ page }) => {
		await seedLibrary(page, seed, 3);
		await edit(page, '/c/aulas');
		const from = await center(page, 'Arrastar “Um”');
		const to = await center(page, 'Arrastar “Três”');
		await page.mouse.move(from.x, from.y);
		await page.mouse.down();
		await page.mouse.move(from.x, from.y + 20, { steps: 4 });
		await page.mouse.move(to.x, to.y + 10, { steps: 12 });
		await expect(page.locator('ul.videos li.lifted')).toHaveCount(1);
		await page.mouse.up();
		await expect.poll(() => titles(page)).toEqual(['Dois', 'Três', 'Um']);
		await expect(page.locator('ul.videos li.lifted')).toHaveCount(0);
		await page.reload();
		await page.getByRole('button', { name: 'Editar', exact: true }).click();
		expect(await titles(page)).toEqual(['Dois', 'Três', 'Um']);
	});

	test('the arrow keys on the handle move a video too', async ({ page }) => {
		await seedLibrary(page, seed, 3);
		await edit(page, '/c/aulas');
		await page.getByRole('button', { name: 'Arrastar “Três”' }).focus();
		await page.keyboard.press('ArrowUp');
		await expect.poll(() => titles(page)).toEqual(['Um', 'Três', 'Dois']);
	});

	test('a pointer that lets go without moving changes nothing', async ({ page }) => {
		await seedLibrary(page, seed, 3);
		await edit(page, '/c/aulas');
		const from = await center(page, 'Arrastar “Dois”');
		await page.mouse.move(from.x, from.y);
		await page.mouse.down();
		await page.mouse.up();
		expect(await titles(page)).toEqual(['Um', 'Dois', 'Três']);
	});

	test('"Todos" has no order of its own, so no handle', async ({ page }) => {
		await seedLibrary(page, seed, 3);
		await edit(page, '/c/todos');
		await expect(page.locator('button[aria-label^="Arrastar"]')).toHaveCount(0);
	});
});

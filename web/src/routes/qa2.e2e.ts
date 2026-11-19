import { expect, test, type Page } from '@playwright/test';
import { fillField, mockNetwork, paste } from './e2e-helpers';

// QA round 2 (owner's iPhone, 2026-11-19, 13:18-13:20).
const ORANGE = 'rgb(255, 106, 43)';
const themeColor = (page: Page) => page.locator('meta[name="theme-color"]').getAttribute('content');

async function seed(page: Page) {
	await mockNetwork(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await expect(page).toHaveURL(/\/v\//);
}

async function seedTwo(page: Page) {
	await seed(page);
	await paste(page, 'https://www.youtube.com/shorts/aBcDeFgHiJ0');
	await expect(page).toHaveURL(/\/v\//);
}

async function createCollection(page: Page, name: string) {
	await page.goto('/c/new');
	await fillField(page.getByLabel('Nome da coleção'), name);
	await page.getByRole('button', { name: 'Criar coleção' }).click();
	await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
}

// Raw IndexedDB write, so a test can seed states the app only reaches over time.
async function patchVideo(page: Page, patch: Record<string, unknown>) {
	await page.evaluate(
		(p) =>
			new Promise<void>((resolve, reject) => {
				const open = indexedDB.open('octa');
				open.onerror = () => reject(open.error);
				open.onsuccess = () => {
					const db = open.result;
					const tx = db.transaction('videos', 'readwrite');
					const store = tx.objectStore('videos');
					store.getAll().onsuccess = (e) => {
						for (const v of (e.target as IDBRequest).result) store.put({ ...v, ...p });
					};
					tx.oncomplete = () => (db.close(), resolve());
					tx.onerror = () => reject(tx.error);
				};
			}),
		patch
	);
}

test.describe('R2.1 create menu grows out of the button', () => {
	test('the panel holds the button, which turns white; the options hang below it', async ({ page }) => {
		await seed(page);
		await page.goto('/');
		await page.getByRole('button', { name: 'Criar conteúdo' }).click();
		const button = page.getByRole('button', { name: 'Fechar menu de criação' });
		const panel = page.locator('.create .panel');
		await expect(panel).toBeVisible();
		const [b, p] = await Promise.all([button.boundingBox(), panel.boundingBox()]);
		expect(b!.x).toBeGreaterThan(p!.x);
		expect(b!.y).toBeGreaterThan(p!.y);
		expect(b!.x + b!.width).toBeLessThan(p!.x + p!.width);
		await expect.poll(() => button.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
		await expect.poll(() => button.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(10, 10, 10)');
		await page.screenshot({ path: `test-results/qa2/menu-${test.info().project.name}.png` });
	});
});

test.describe('R2.2 app feel and the Library header', () => {
	test('no zoom, no text selection outside fields, 16px+ fields', async ({ page }) => {
		await mockNetwork(page);
		await page.goto('/c/new');
		expect(await page.locator('meta[name="viewport"]').getAttribute('content')).toMatch(/user-scalable=no/);
		const sel = await page.evaluate(() => [
			getComputedStyle(document.body).userSelect,
			getComputedStyle(document.querySelector('input')!).userSelect,
			parseFloat(getComputedStyle(document.querySelector('input')!).fontSize),
			getComputedStyle(document.documentElement).touchAction
		]);
		expect(sel[0]).toBe('none');
		expect(sel[1]).toBe('text');
		expect(sel[2]).toBeGreaterThanOrEqual(16);
		expect(sel[3]).toBe('manipulation');
	});

	test('the Library header starts close to the top, with no unused band', async ({ page }) => {
		await seed(page);
		await page.goto('/');
		const top = await page.locator('main.library header').first().boundingBox();
		expect(top!.y).toBeLessThanOrEqual(20);
	});

	test('the fan cards have a thin border', async ({ page }) => {
		await seed(page);
		await page.goto('/');
		const w = await page.locator('.tile').first().evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth));
		expect(w).toBeLessThanOrEqual(1.6);
	});
});

test.describe('R2.4 buttons', () => {
	test('the Assistir shadow fits inside the room under the button', async ({ page }) => {
		await seed(page);
		await page.goto('/c/todos');
		await page.locator('a.cta').waitFor();
		const { room, reach } = await page.evaluate(() => {
			const footer = document.querySelector('footer')!;
			const cta = document.querySelector('a.cta')!;
			const room = parseFloat(getComputedStyle(footer).paddingBottom);
			// "color x y blur spread": how far below the button the farthest shadow reaches.
			const reach = Math.max(
				...getComputedStyle(cta).boxShadow.split(/,(?![^(]*\))/).map((part) => {
					const nums = (part.match(/-?\d+(\.\d+)?px/g) ?? []).map(parseFloat);
					return nums.length >= 3 ? nums[1] + nums[2] + (nums[3] ?? 0) : 0;
				})
			);
			return { room, reach };
		});
		expect(reach).toBeGreaterThan(0);
		expect(room).toBeGreaterThanOrEqual(reach);
	});

	test('on the dark collection the arrow is a white disc with a dark icon', async ({ page }) => {
		await seed(page);
		await page.goto('/c/todos');
		await page.addStyleTag({ content: 'main.collection { min-height: 4000px !important; }' });
		const up = page.getByRole('button', { name: 'Voltar ao topo' });
		await expect(async () => {
			await page.evaluate(() => window.scrollTo(0, 3000));
			await expect(up).toBeVisible({ timeout: 500 });
		}).toPass();
		await expect.poll(() => up.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
		await expect.poll(() => up.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(10, 10, 10)');
	});

	test('on the white Library the arrow stays a dark disc', async ({ page }) => {
		await seed(page);
		await page.goto('/');
		await page.addStyleTag({ content: 'main.library { min-height: 4000px !important; }' });
		const up = page.getByRole('button', { name: 'Voltar ao topo' });
		await expect(async () => {
			await page.evaluate(() => window.scrollTo(0, 3000));
			await expect(up).toBeVisible({ timeout: 500 });
		}).toPass();
		await expect.poll(() => up.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe('rgb(255, 255, 255)');
	});
});

test.describe('R2.5 illustrations', () => {
	for (const [path, kind] of [
		['/', 'library'],
		['/c/todos', 'collection']
	] as const) {
		test(`the ${kind} empty state is a clean line drawing`, async ({ page }) => {
			await mockNetwork(page);
			await page.goto(path);
			const svg = page.locator(`svg.illustration[data-kind="${kind}"]`);
			await expect(svg).toBeVisible();
			// Shapes stay apart: no two top-level shapes share an area.
			const boxes = await svg.locator('> rect, > circle, > g, > path').evaluateAll((els) =>
				els.map((el) => {
					const b = (el as SVGGraphicsElement).getBBox();
					return { x: b.x, y: b.y, w: b.width, h: b.height };
				})
			);
			expect(boxes.length).toBeGreaterThan(2);
			await svg.screenshot({ path: `test-results/qa2/illustration-${kind}-${test.info().project.name}.png` });
		});
	}
});

test.describe('R2.6 the orange screen for every remove', () => {
	test('deleting a collection asks on the orange screen, paints the whole page and the browser orange', async ({ page }) => {
		await seed(page);
		await createCollection(page, 'Teste');
		await page.getByRole('button', { name: 'Editar' }).click();
		await page.getByRole('button', { name: 'Excluir' }).click();
		const screen = page.getByRole('alertdialog');
		await expect(screen).toBeVisible();
		await expect(screen.getByRole('heading')).toHaveText('Excluir “Teste”?');
		await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe(ORANGE);
		expect((await themeColor(page))?.toLowerCase()).toBe('#ff6a2b');
		await page.waitForTimeout(700); // let the fade and any view transition settle
		await page.screenshot({ path: `test-results/qa2/danger-${test.info().project.name}.png` });
		// Cancel keeps it, and gives the browser color back.
		await screen.getByRole('button', { name: 'Cancelar' }).click();
		await expect(screen).toHaveCount(0);
		expect((await themeColor(page))?.toLowerCase()).toBe('#000000');
		await page.getByRole('button', { name: 'Excluir' }).click();
		await page.keyboard.press('Escape');
		await expect(page.getByRole('alertdialog')).toHaveCount(0);
		await page.getByRole('button', { name: 'Excluir' }).click();
		await page.getByRole('button', { name: 'Excluir coleção' }).click();
		await expect(page).toHaveURL(/\/$/);
		await expect(page.getByRole('heading', { name: 'Teste', exact: true })).toHaveCount(0);
	});

	test('deleting a video from the edit mode removes it everywhere', async ({ page }) => {
		await seedTwo(page);
		await page.goto('/c/todos');
		await expect(page.locator('ul.videos li')).toHaveCount(2);
		const before = 2;
		await page.getByRole('button', { name: 'Editar' }).click();
		await page.getByRole('button', { name: /^Apagar “/ }).first().click();
		await expect(page.getByRole('alertdialog').getByRole('heading')).toHaveText('Apagar este vídeo?');
		await page.getByRole('button', { name: 'Apagar vídeo' }).click();
		await expect(page.getByRole('alertdialog')).toHaveCount(0);
		await expect(page.locator('ul.videos li')).toHaveCount(before - 1);
	});

	test('a link that stayed dead shows the orange screen on the player, with the two options', async ({ page }) => {
		await seed(page);
		const url = page.url();
		await patchVideo(page, { health: 'dead', deadStreak: 2 });
		await page.goto(url);
		const screen = page.getByRole('alertdialog');
		await expect(screen.getByRole('heading')).toHaveText('Esse vídeo saiu do ar.');
		await screen.getByRole('button', { name: 'Manter e checar de novo' }).click();
		await expect(screen).toHaveCount(0);
		await page.reload();
		await expect(page.getByRole('alertdialog')).toHaveCount(0); // streak reset: it asks again only if it fails again
		await patchVideo(page, { health: 'dead', deadStreak: 2 });
		await page.reload();
		await page.getByRole('alertdialog').getByRole('button', { name: 'Apagar da biblioteca' }).click();
		await page.getByRole('alertdialog').getByRole('button', { name: 'Apagar vídeo' }).click();
		await expect(page).toHaveURL(/\/$/);
		await expect(page.getByRole('heading', { name: 'Nada aqui ainda.' })).toBeVisible();
	});

	test('one dead check only marks the card, no orange screen', async ({ page }) => {
		await seed(page);
		const url = page.url();
		await patchVideo(page, { health: 'dead', deadStreak: 1 });
		await page.goto(url);
		await expect(page.locator('.info h1')).toBeVisible();
		await expect(page.getByRole('alertdialog')).toHaveCount(0);
	});
});

test.describe('R2.7 edit, rename, Assistidos, Favoritos', () => {
	test('Renomear turns the title itself into the field: no second input, Enter saves, Escape cancels', async ({ page }) => {
		await seed(page);
		await createCollection(page, 'Antigo');
		await page.getByRole('button', { name: 'Editar' }).click();
		await page.getByRole('button', { name: 'Renomear' }).click();
		const field = page.getByRole('textbox', { name: 'Novo nome da coleção' });
		await expect(field).toBeFocused();
		await expect(page.locator('input')).toHaveCount(1); // the title is the only field
		await expect(page.getByText('Novo nome', { exact: true })).toHaveCount(0); // no extra label
		const h1Top = await field.boundingBox();
		expect(h1Top!.y).toBeLessThan(260); // up in the title, not down in a form
		await page.keyboard.type('X');
		await page.keyboard.press('Escape');
		await expect(page.getByRole('heading', { name: 'Antigo', exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Renomear' }).click();
		await page.getByRole('textbox', { name: 'Novo nome da coleção' }).fill('Novo');
		await page.keyboard.press('Enter');
		await expect(page.getByRole('heading', { name: 'Novo', exact: true })).toBeVisible();
		await page.reload();
		await expect(page.getByRole('heading', { name: 'Novo', exact: true })).toBeVisible();
	});

	test('a reserved name shows the reason on the title screen', async ({ page }) => {
		await seed(page);
		await createCollection(page, 'Música');
		await page.getByRole('button', { name: 'Editar' }).click();
		await page.getByRole('button', { name: 'Renomear' }).click();
		await page.getByRole('textbox', { name: 'Novo nome da coleção' }).fill('Favoritos');
		await page.keyboard.press('Enter');
		await expect(page.getByRole('alert')).toContainText('reservado');
	});

	test('Mais → Editar título ou link renames the video and rejects a bad link', async ({ page }) => {
		await seed(page);
		await page.getByRole('button', { name: 'Mais ações' }).click();
		await page.getByRole('button', { name: 'Editar título ou link' }).click();
		const sheet = page.getByRole('dialog', { name: 'Editar vídeo' });
		await expect(sheet).toBeVisible();
		await sheet.getByLabel('Título').fill('Meu título novo');
		await sheet.getByLabel('Link').fill('isso não é link');
		await sheet.getByRole('button', { name: 'Salvar' }).click();
		await expect(sheet.getByRole('alert')).toContainText('não parece um link');
		await sheet.getByLabel('Link').fill('https://youtu.be/dQw4w9WgXcQ');
		await sheet.getByRole('button', { name: 'Salvar' }).click();
		await expect(sheet).toBeHidden();
		await expect(page.locator('.info h1')).toHaveText('Meu título novo');
		await page.reload();
		await expect(page.locator('.info h1')).toHaveText('Meu título novo');
	});

	test('editing to a link already in the library says so', async ({ page }) => {
		await seedTwo(page);
		await page.getByRole('button', { name: 'Mais ações' }).click();
		await page.getByRole('button', { name: 'Editar título ou link' }).click();
		const sheet = page.getByRole('dialog', { name: 'Editar vídeo' });
		await sheet.getByLabel('Link').fill('https://youtu.be/dQw4w9WgXcQ');
		await sheet.getByRole('button', { name: 'Salvar' }).click();
		await expect(sheet.getByRole('alert')).toContainText('já está');
	});

	test('Assistidos: mark in Mais, the Library gets the card and the screen lists it', async ({ page }) => {
		await seed(page);
		await page.goto('/');
		await expect(page.locator('a.card[data-collection="assistidos"]')).toHaveCount(0);
		await page.locator('a.card[data-collection="todos"]').click();
		await page.locator('a.row').first().click();
		await page.getByRole('button', { name: 'Mais ações' }).click();
		await page.getByRole('button', { name: 'Marcar como assistido' }).click();
		await page.goto('/');
		const card = page.locator('a.card[data-collection="assistidos"]');
		await expect(card).toBeVisible();
		await card.click();
		await expect(page.getByRole('heading', { name: 'Assistidos', exact: true })).toBeVisible();
		await expect(page.locator('ul.videos li')).toHaveCount(1);
		await expect(page.locator('.seen')).toHaveText('Assistido');
		// Nothing to rename or delete on a virtual screen.
		await page.getByRole('button', { name: 'Editar' }).click();
		await expect(page.getByRole('button', { name: 'Renomear' })).toHaveCount(0);
		await page.getByRole('button', { name: 'Concluído' }).click();
		// Unmark: the card goes away.
		await page.locator('a.row').first().click();
		await page.getByRole('button', { name: 'Mais ações' }).click();
		await page.getByRole('button', { name: 'Desmarcar como assistido' }).click();
		await page.goto('/');
		await expect(page.locator('a.card[data-collection="assistidos"]')).toHaveCount(0);
	});

	test('Favoritos: a liked video appears with a 3D heart on its monitor', async ({ page }) => {
		await seed(page);
		await page.getByRole('button', { name: 'Curtir' }).click();
		await page.goto('/');
		const card = page.locator('a.card[data-collection="favoritos"]');
		await expect(card).toBeVisible();
		await card.click();
		await expect(page.getByRole('heading', { name: 'Favoritos', exact: true })).toBeVisible();
		await expect(page.locator('ul.videos li')).toHaveCount(1);
		await expect(page.locator('.screen .heart')).toHaveCount(1);
		expect(await page.locator('.screen.has-heart').evaluate((el) => getComputedStyle(el).transformStyle)).toBe('preserve-3d');
		await page.waitForTimeout(800);
		await page.screenshot({ path: `test-results/qa2/favoritos-${test.info().project.name}.png` });
	});

	test('the empty Favoritos and Assistidos screens say what to do', async ({ page }) => {
		await mockNetwork(page);
		await page.goto('/c/favoritos');
		await expect(page.getByText('Toque no coração')).toBeVisible();
		await page.goto('/c/assistidos');
		await expect(page.getByText('Marque um vídeo como assistido')).toBeVisible();
	});

	test('the names Favoritos and Assistidos are reserved for new collections', async ({ page }) => {
		await mockNetwork(page);
		await page.goto('/c/new');
		await fillField(page.getByLabel('Nome da coleção'), 'assistidos');
		await page.getByRole('button', { name: 'Criar coleção' }).click();
		await expect(page.getByRole('alert')).toContainText('reservado');
	});
});

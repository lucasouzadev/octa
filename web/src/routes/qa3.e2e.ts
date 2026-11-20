import { expect, test, type Page } from '@playwright/test';
import { mockNetwork, paste } from './e2e-helpers';

// QA round 3 (owner's iPhone, 2026-11-19 17:31-17:37, list of 13 items).

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
	await page.getByLabel('Nome da coleção').fill(name);
	await page.getByRole('button', { name: 'Criar coleção' }).click();
	await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
}

const box = async (loc: ReturnType<Page['locator']>) => (await loc.boundingBox())!;

test.describe('R3.2 Editar: the options sit below the card', () => {
	test('each card keeps the full width and its three buttons are under it', async ({ page }) => {
		await seedTwo(page);
		await page.goto('/c/todos');
		await page.getByRole('button', { name: 'Editar', exact: true }).click();
		const rows = page.locator('.videos.editing li');
		await expect(rows).toHaveCount(2);
		const list = await box(page.locator('.videos.editing'));
		for (let i = 0; i < 2; i++) {
			const card = await box(rows.nth(i).locator('.screen'));
			const buttons = rows.nth(i).locator('.row-buttons .chip');
			await expect(buttons).toHaveCount(3);
			// The card is not squeezed by the buttons.
			expect(card.width).toBeGreaterThan(list.width * 0.9);
			const first = await box(buttons.first());
			const last = await box(buttons.last());
			expect(first.y).toBeGreaterThanOrEqual(card.y + card.height - 1);
			expect(first.x).toBeGreaterThanOrEqual(list.x - 1);
			expect(last.x + last.width).toBeLessThanOrEqual(list.x + list.width + 1);
		}
		const vw = page.viewportSize()!.width;
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vw);
	});
});

test.describe('R3.11 empty library with collections', () => {
	test('the collection card comes first, the actions below it, no illustration', async ({ page }) => {
		await mockNetwork(page);
		await page.goto('/c/new');
		await page.getByLabel('Nome da coleção').fill('Teste');
		await page.getByRole('button', { name: 'Criar coleção' }).click();
		await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
		await page.goto('/');
		const card = page.locator('a.card[data-collection]').first();
		const paste = page.getByRole('link', { name: 'Colar um link' });
		const create = page.getByRole('link', { name: 'Nova coleção' });
		await expect(card).toContainText('Teste');
		await expect(paste).toBeVisible();
		await expect(create).toBeVisible();
		await expect(page.locator('svg.illustration')).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Nada aqui ainda.' })).toHaveCount(0);
		const c = await box(card);
		expect((await box(paste)).y).toBeGreaterThan(c.y + c.height - 1);
		expect((await box(create)).y).toBeGreaterThan(c.y + c.height - 1);
	});

	test('with no collection the empty library keeps its illustration and actions', async ({ page }) => {
		await mockNetwork(page);
		await page.goto('/');
		await expect(page.locator('svg.illustration[data-kind="library"]')).toBeVisible();
		await expect(page.getByRole('link', { name: 'Colar um link' })).toBeVisible();
	});

	test('after the first video the action buttons are gone', async ({ page }) => {
		await seed(page);
		await page.goto('/');
		await expect(page.getByRole('link', { name: 'Colar um link' })).toHaveCount(0);
		await expect(page.getByRole('link', { name: 'Nova coleção' })).toHaveCount(0);
		await expect(page.locator('svg.illustration')).toHaveCount(0);
	});
});

test.describe('R3.10 safe area', () => {
	test('a strip over the status bar fades what scrolls under it, and never takes a touch', async ({ page }) => {
		await seedTwo(page);
		await page.goto('/');
		const strip = page.locator('.safe-top');
		await expect(strip).toHaveCount(1);
		const css = await strip.evaluate((el) => {
			const s = getComputedStyle(el);
			return { position: s.position, top: s.top, events: s.pointerEvents, image: s.backgroundImage, height: parseFloat(s.height) };
		});
		expect(css.position).toBe('fixed');
		expect(css.top).toBe('0px');
		expect(css.events).toBe('none');
		expect(css.image).toContain('linear-gradient');
		expect(css.height).toBeGreaterThan(0);
	});

	test('the strip takes the color of the screen: white on the library, black on the collection', async ({ page }) => {
		await seed(page);
		const color = () =>
			page.locator('.safe-top').evaluate((el) => getComputedStyle(el).getPropertyValue('--safe-bg').trim().toLowerCase());
		await page.goto('/');
		await expect.poll(color).toBe('#ffffff');
		await page.goto('/c/todos');
		await expect.poll(color).toBe('#000000');
	});
});

test.describe('R3.12 the "+" menu leaves the way it came', () => {
	test('closing plays an exit before the menu goes away', async ({ page }) => {
		await seed(page);
		await page.goto('/');
		await page.getByRole('button', { name: 'Criar conteúdo' }).click();
		await expect(page.getByRole('menu', { name: 'Criar conteúdo' })).toBeVisible();
		await page.getByRole('button', { name: 'Fechar menu de criação' }).click();
		// Still on screen while it leaves, marked as closing.
		await expect(page.locator('.create[data-state="closing"]')).toHaveCount(1);
		await expect(page.locator('.create .panel')).toHaveCount(1);
		await expect(page.locator('.create .panel')).toHaveCount(0, { timeout: 1500 });
		await expect(page.getByRole('button', { name: 'Criar conteúdo' })).toHaveAttribute('aria-expanded', 'false');
	});

	test('reduced motion: it goes at once', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await seed(page);
		await page.goto('/');
		await page.getByRole('button', { name: 'Criar conteúdo' }).click();
		await page.getByRole('button', { name: 'Fechar menu de criação' }).click();
		await expect(page.locator('.create .panel')).toHaveCount(0);
	});

	test('tapping outside also plays the exit', async ({ page }) => {
		await seed(page);
		await page.goto('/');
		await page.getByRole('button', { name: 'Criar conteúdo' }).click();
		await page.locator('.heading h1').click();
		await expect(page.locator('.create[data-state="closing"]')).toHaveCount(1);
		await expect(page.locator('.create .panel')).toHaveCount(0, { timeout: 1500 });
	});
});

test.describe('R3.6 / R3.7 paste and new collection screens', () => {
	for (const path of ['/add', '/c/new']) {
		test(`${path}: a plain field, no bar over the keyboard`, async ({ page }) => {
			await mockNetwork(page);
			await page.goto(path);
			const field = page.getByLabel(path === '/add' ? 'Link do vídeo' : 'Nome da coleção');
			const before = await box(page.locator('h1'));
			await field.click();
			await expect(page.locator('.dim')).toHaveCount(0);
			await expect(page.locator('.field.docked')).toHaveCount(0);
			await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden');
			// The field stays in the page: it did not jump to a bar.
			expect((await box(page.locator('h1'))).y).toBe(before.y);
			// And the page's own button is still the one that sends.
			await expect(page.getByRole('button', { name: path === '/add' ? 'Gerar player' : 'Criar coleção' })).toBeVisible();
			await expect(page.getByRole('button', { name: 'Enviar' })).toHaveCount(0);
		});

		test(`${path}: the icon sits on the same line as the X, at the opposite edge`, async ({ page }) => {
			await mockNetwork(page);
			await page.goto(path);
			const x = await box(page.locator('a.close'));
			const icon = await box(page.locator('header .mark'));
			expect(Math.abs(icon.y + icon.height / 2 - (x.y + x.height / 2))).toBeLessThan(2);
			expect(icon.x).toBeLessThan(x.x);
			const vw = page.viewportSize()!.width;
			expect(icon.x + icon.width / 2).toBeLessThan(vw / 2);
			expect(x.x + x.width / 2).toBeGreaterThan(vw / 2);
		});

		test(`${path}: a fixed blue layer sits under the page, so no white shows around the keyboard`, async ({ page }) => {
			await mockNetwork(page);
			await page.goto(path);
			const layer = await page.locator('main.on-blue').evaluate((el) => {
				const s = getComputedStyle(el, '::before');
				return { position: s.position, color: s.backgroundColor, z: s.zIndex, inset: [s.top, s.bottom, s.left, s.right] };
			});
			expect(layer.position).toBe('fixed');
			expect(layer.color).toBe('rgb(26, 60, 255)');
			expect(Number(layer.z)).toBeLessThan(0);
			expect(layer.inset).toEqual(['0px', '0px', '0px', '0px']);
		});
	}

	test('/add still sends with Enter and shows errors under the field', async ({ page }) => {
		await mockNetwork(page);
		await page.goto('/add');
		await page.getByLabel('Link do vídeo').fill('isso nao e link');
		await page.getByLabel('Link do vídeo').press('Enter');
		await expect(page.getByRole('alert')).toContainText('não parece um link');
	});

	test('/c/new still shows a reserved-name error', async ({ page }) => {
		await mockNetwork(page);
		await page.goto('/c/new');
		await page.getByLabel('Nome da coleção').fill('todos');
		await page.getByRole('button', { name: 'Criar coleção' }).click();
		await expect(page.getByRole('alert')).toContainText('reservado');
	});
});

test.describe('R3.4 Apagar: the cover is clear and big', () => {
	test('no film over the cover and a bigger preview', async ({ page }) => {
		await seed(page);
		await page.goto('/c/todos');
		await page.getByRole('button', { name: 'Editar', exact: true }).click();
		await page.getByRole('button', { name: /^Apagar/ }).click();
		const thumb = page.locator('.danger .thumb');
		await expect(thumb).toHaveCount(1);
		const css = await thumb.evaluate((el) => {
			const s = getComputedStyle(el);
			return { opacity: s.opacity, filter: s.filter, z: s.zIndex };
		});
		expect(css.opacity).toBe('1');
		expect(css.filter).toBe('none');
		const vw = page.viewportSize()!.width;
		expect((await box(thumb)).width).toBeGreaterThanOrEqual(Math.min(vw * 0.8, 400));
		// It is in front of the orange, behind only the words.
		await expect(page.locator('.danger')).toHaveCSS('background-color', 'rgb(255, 106, 43)');
	});
});

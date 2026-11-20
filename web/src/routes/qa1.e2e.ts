import { expect, test, type Page } from '@playwright/test';
import { fillField, mockNetwork, paste } from './e2e-helpers';

// QA round 1 (owner's iPhone, 2026-11-19). One block per item, in the owner's order.

const BLUE = 'rgb(26, 60, 255)';
const themeColor = (page: Page) => page.locator('meta[name="theme-color"]').getAttribute('content');
const pageBackground = (page: Page) =>
	page.evaluate(() => [document.documentElement, document.body].map((el) => getComputedStyle(el).backgroundColor));

async function seed(page: Page) {
	await mockNetwork(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await expect(page).toHaveURL(/\/v\//);
}

test.describe('R1.8 one color edge to edge', () => {
	test('blue screens paint html, body and the browser theme blue', async ({ page }) => {
		await mockNetwork(page);
		for (const path of ['/add', '/c/new']) {
			await page.goto(path);
			await expect(page.locator('main.on-blue')).toBeVisible();
			expect(await pageBackground(page)).toEqual([BLUE, BLUE]);
			expect((await themeColor(page))?.toLowerCase()).toBe('#1a3cff');
		}
	});

	test('library is white and collection/player are black, theme color follows', async ({ page }) => {
		await seed(page);
		await page.goto('/');
		await expect(page.locator('main.library')).toBeVisible();
		expect(await pageBackground(page)).toEqual(['rgb(255, 255, 255)', 'rgb(255, 255, 255)']);
		expect((await themeColor(page))?.toLowerCase()).toBe('#ffffff');
		await page.goto('/c/todos');
		await expect(page.locator('main.on-dark')).toBeVisible();
		expect(await pageBackground(page)).toEqual(['rgb(0, 0, 0)', 'rgb(0, 0, 0)']);
		expect((await themeColor(page))?.toLowerCase()).toBe('#000000');
	});

	test('the theme color changes on client navigation, not only on reload', async ({ page }) => {
		await seed(page);
		await page.goto('/');
		await page.goto('/c/todos');
		await page.getByRole('link', { name: 'Voltar' }).click();
		await expect(page.locator('main.library')).toBeVisible();
		expect((await themeColor(page))?.toLowerCase()).toBe('#ffffff');
	});
});

test.describe('R1.7 Assistir em sequência', () => {
	test('has no band or gradient behind it, only a soft shadow, and an icon with its own fill', async ({ page }) => {
		await seed(page);
		await page.goto('/c/todos');
		const footer = page.locator('main > footer');
		await expect(footer).toBeVisible();
		const f = await footer.evaluate((el) => {
			const s = getComputedStyle(el);
			return { image: s.backgroundImage, color: s.backgroundColor };
		});
		expect(f.image).toBe('none');
		expect(f.color).toBe('rgba(0, 0, 0, 0)');
		const cta = footer.locator('a.cta');
		expect(await cta.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none');
		const icon = cta.locator('.icon');
		await expect(icon).toBeVisible();
		const bg = await icon.evaluate((el) => getComputedStyle(el).backgroundColor);
		expect(bg).not.toBe('rgba(0, 0, 0, 0)');
		// The icon is a filled disc, so it must differ from the white button around it.
		expect(bg).not.toBe(await cta.evaluate((el) => getComputedStyle(el).backgroundColor));
	});
});

test.describe('R1.3 native sheet', () => {
	async function openMove(page: Page) {
		await seed(page);
		await page.goto('/c/todos');
		await page.getByRole('button', { name: 'Editar' }).click();
		await page.getByRole('button', { name: /^Mover/ }).first().click();
		const sheet = page.getByRole('dialog', { name: 'Mover para' });
		await expect(sheet).toBeVisible();
		await expect(sheet).toHaveAttribute('data-state', 'open');
		// Let the slide-up finish so the handle holds still while the test grabs it.
		await expect
			.poll(() => sheet.locator('.rise').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42))
			.toBeLessThan(0.5);
		return sheet;
	}

	async function drag(page: Page, from: { x: number; y: number }, dy: number) {
		await page.mouse.move(from.x, from.y);
		await page.mouse.down();
		for (let i = 1; i <= 8; i++) await page.mouse.move(from.x, from.y + (dy * i) / 8);
		return () => page.mouse.up();
	}

	test('has a handle, opens by sliding up, and nothing is focused with a ring', async ({ page }) => {
		const sheet = await openMove(page);
		const handle = sheet.locator('.handle');
		await expect(handle).toBeVisible();
		const panel = sheet.locator('.rise');
		expect(parseFloat(await panel.evaluate((el) => getComputedStyle(el).transitionDuration))).toBeGreaterThan(0.1);
		// The old sheet focused its first option and drew a white ring around it.
		const focused = await page.evaluate(() => document.activeElement?.matches('button.option, a.option') ?? false);
		expect(focused).toBe(false);
	});

	test('a long drag down on the handle closes it; a short one springs back', async ({ page }) => {
		const sheet = await openMove(page);
		const panel = sheet.locator('.rise');
		const box = (await sheet.locator('.handle').boundingBox())!;
		const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

		const release = await drag(page, at, 30);
		expect(await panel.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42)).toBeGreaterThan(10);
		await release();
		await expect(sheet).toBeVisible();
		await expect.poll(() => panel.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42)).toBeLessThan(1);

		const again = await drag(page, at, 260);
		await again();
		await expect(sheet).toBeHidden();
		// Closing by gesture leaves the screen as it was (editing mode, both videos).
		await expect(page.getByRole('button', { name: 'Concluído' })).toBeVisible();
	});

	test('pulling up resists and springs back', async ({ page }) => {
		const sheet = await openMove(page);
		const panel = sheet.locator('.rise');
		const box = (await sheet.locator('.handle').boundingBox())!;
		const release = await drag(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, -300);
		const y = await panel.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42);
		expect(y).toBeLessThan(0);
		expect(y).toBeGreaterThan(-60);
		await release();
		await expect(sheet).toBeVisible();
		await expect.poll(() => panel.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42)).toBeGreaterThan(-1);
	});

	test('Escape and a tap on the backdrop close it', async ({ page }) => {
		const sheet = await openMove(page);
		await page.keyboard.press('Escape');
		await expect(sheet).toBeHidden();
		await page.getByRole('button', { name: /^Mover/ }).first().click();
		await expect(sheet).toBeVisible();
		await page.mouse.click(5, 5);
		await expect(sheet).toBeHidden();
	});

	test('reduced motion: no slide', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		const sheet = await openMove(page);
		expect(parseFloat(await sheet.locator('.rise').evaluate((el) => getComputedStyle(el).transitionDuration))).toBeLessThan(0.001);
	});
});

test.describe('R1.4 viewer', () => {
	async function seedBoth(page: Page) {
		await seed(page);
		await paste(page, 'https://www.youtube.com/shorts/aBcDeFgHiJ0');
		await expect(page).toHaveURL(/\/v\//);
	}

	test('actions are Compartilhar, Mover, Curtir, Próximo, in that order', async ({ page }) => {
		await seedBoth(page);
		await expect(page.locator('.actions button')).toHaveCount(4);
		const names = await page.locator('.actions button').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
		expect(names).toEqual(['Compartilhar', 'Mover', 'Curtir', 'Próximo vídeo']);
	});

	for (const size of [
		{ width: 390, height: 664 }, // small iPhone with the browser bars showing
		{ width: 390, height: 744 },
		{ width: 834, height: 1000 },
		{ width: 1440, height: 800 }
	]) {
		test(`fits ${size.width}x${size.height} without scrolling or cutting anything, video and Short`, async ({ page }) => {
			await page.setViewportSize(size);
			await seedBoth(page);
			for (const label of ['short', 'video']) {
				await page.goto('/c/todos');
				await page.locator('a.row').nth(label === 'short' ? 0 : 1).click();
				await expect(page.locator('.player .frame')).toBeVisible();
				const m = await page.evaluate(() => {
					const rect = (s: string) => document.querySelector(s)!.getBoundingClientRect();
					const frame = rect('.player .frame');
					const actions = rect('.actions');
					return {
						scroll: document.documentElement.scrollHeight - window.innerHeight,
						frameTop: frame.top,
						frameBottom: frame.bottom,
						frameLeft: frame.left,
						frameRight: frame.right,
						actionsTop: actions.top,
						actionsBottom: actions.bottom,
						width: window.innerWidth,
						height: window.innerHeight
					};
				});
				await expect(page.locator('html')).not.toHaveAttribute('data-vt', /.+/);
				await page.waitForTimeout(500);
				await page.screenshot({ path: `test-results/qa1/viewer-${size.width}x${size.height}-${label}.png` });
				expect(m.scroll, `${label}: page scrolls`).toBeLessThanOrEqual(1);
				expect(m.frameTop, `${label}: frame cut at top`).toBeGreaterThanOrEqual(0);
				expect(m.frameLeft).toBeGreaterThanOrEqual(0);
				expect(m.frameRight).toBeLessThanOrEqual(m.width);
				expect(m.frameBottom, `${label}: frame under the actions`).toBeLessThanOrEqual(m.actionsTop);
				expect(m.actionsBottom, `${label}: actions cut at bottom`).toBeLessThanOrEqual(m.height);
				// The video keeps a usable size: at least 140px tall even on the smallest screen.
				expect(m.frameBottom - m.frameTop).toBeGreaterThanOrEqual(140);
			}
		});
	}

	test('Curtir sends hearts up once, and unliking sends none', async ({ page }) => {
		await seedBoth(page);
		const like = page.getByRole('button', { name: 'Curtir' });
		await like.click();
		await expect(like).toHaveAttribute('aria-pressed', 'true');
		await expect(page.locator('.hearts .heart').first()).toBeVisible();
		expect(await page.locator('.hearts .heart').count()).toBeGreaterThanOrEqual(6);
		// They clean themselves up.
		await expect(page.locator('.hearts .heart')).toHaveCount(0, { timeout: 4000 });
		await like.click();
		await expect(like).toHaveAttribute('aria-pressed', 'false');
		await expect(page.locator('.hearts .heart')).toHaveCount(0);
	});

	test('reduced motion: liking sends no hearts', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await seedBoth(page);
		await page.getByRole('button', { name: 'Curtir' }).click();
		await expect(page.getByRole('button', { name: 'Curtir' })).toHaveAttribute('aria-pressed', 'true');
		await expect(page.locator('.hearts .heart')).toHaveCount(0);
	});

	test('Mover opens the same sheet, moves the video and keeps playing it', async ({ page }) => {
		await seedBoth(page);
		await page.goto('/c/new');
		await fillField(page.getByLabel('Nome da coleção'), 'Música');
		await page.getByRole('button', { name: 'Criar coleção' }).click();
		await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
		await page.goto('/c/todos');
		await page.locator('a.row').first().click();
		await expect(page).toHaveURL(/\/v\//);
		const title = await page.locator('.info h1').innerText();
		await page.getByRole('button', { name: 'Mover' }).click();
		const sheet = page.getByRole('dialog', { name: 'Mover para' });
		await expect(sheet).toBeVisible();
		await sheet.getByRole('button', { name: 'Música' }).click();
		await expect(sheet).toBeHidden();
		// Still on the same video, now inside the collection.
		await expect(page).toHaveURL(/\?c=[0-9a-f-]{36}$/);
		await expect(page.locator('.info h1')).toHaveText(title);
	});
});

test.describe('R1.1 / R1.2 create screens', () => {
	test('close is on the right and the title sits high on the screen', async ({ page }) => {
		await mockNetwork(page);
		for (const path of ['/c/new', '/add']) {
			await page.goto(path);
			const close = (await page.locator('a.close').boundingBox())!;
			const width = page.viewportSize()!.width;
			expect(close.x + close.width / 2, `${path}: X not on the right`).toBeGreaterThan(width / 2);
			const h1 = (await page.locator('h1').boundingBox())!;
			// Used to start near the middle of the screen; now it opens the content.
			expect(h1.y, `${path}: title too low`).toBeLessThan(page.viewportSize()!.height * 0.3);
		}
	});

	test('Colar fills the link from the clipboard, only on the link screen', async ({ page, context }) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await mockNetwork(page);
		await page.goto('/add');
		await page.evaluate(() => navigator.clipboard.writeText('https://youtu.be/dQw4w9WgXcQ'));
		await page.getByRole('button', { name: 'Colar', exact: true }).click();
		await expect(page.getByLabel('Link do vídeo')).toHaveValue('https://youtu.be/dQw4w9WgXcQ');
		await page.goto('/c/new');
		await expect(page.getByRole('button', { name: 'Colar', exact: true })).toHaveCount(0);
	});

	test('Colar says so when the clipboard cannot be read', async ({ page }) => {
		await mockNetwork(page);
		await page.addInitScript(() => {
			Object.defineProperty(navigator, 'clipboard', {
				value: { readText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) },
				configurable: true
			});
		});
		await page.goto('/add');
		await page.getByRole('button', { name: 'Colar', exact: true }).click();
		await expect(page.getByRole('alert')).toContainText('área de transferência');
		await expect(page.getByLabel('Link do vídeo')).toHaveValue('');
	});
});

test.describe('R1.6 create menu, empty states, back to top', () => {
	test('empty library: illustration and two actions, no "+", no dashed card, no placeholder cards', async ({ page }) => {
		await mockNetwork(page);
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Nada aqui ainda.' })).toBeVisible();
		await expect(page.locator('svg.illustration[data-kind="library"]')).toBeVisible();
		await expect(page.getByRole('link', { name: 'Colar um link' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Nova coleção' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Criar conteúdo' })).toHaveCount(0);
		await expect(page.locator('a.card.new, .tile')).toHaveCount(0);
	});

	test('the "+" appears after the first link and opens a popover from the button', async ({ page }) => {
		await seed(page);
		await page.goto('/');
		const toggle = page.getByRole('button', { name: 'Criar conteúdo' });
		await expect(toggle).toBeVisible();
		await expect(page.locator('a.card.new')).toHaveCount(0);
		await toggle.click();
		const close = page.getByRole('button', { name: 'Fechar menu de criação' });
		await expect(close).toHaveAttribute('aria-expanded', 'true');
		const menu = page.getByRole('menu', { name: 'Criar conteúdo' });
		await expect(menu).toBeVisible();
		await expect(menu.getByRole('menuitem')).toHaveText([/Colar link/, /Nova coleção/]);
		await expect(menu.locator('svg')).toHaveCount(2); // one icon per option
		// The panel grows out of the button: the button sits inside it, filled white.
		const panel = page.locator('.create .panel');
		const [b, p] = await Promise.all([close.boundingBox(), panel.boundingBox()]);
		expect(b!.x).toBeGreaterThanOrEqual(p!.x);
		expect(b!.y).toBeGreaterThanOrEqual(p!.y);
		expect(b!.x + b!.width).toBeLessThanOrEqual(p!.x + p!.width);
		expect(b!.y + b!.height).toBeLessThan(p!.y + p!.height);
		expect(Math.abs(p!.x + p!.width - (b!.x + b!.width))).toBeLessThan(10); // same right edge
		const m = await menu.boundingBox();
		expect(m!.y).toBeGreaterThanOrEqual(b!.y + b!.height - 1); // options hang under the button
		await expect
			.poll(() => close.evaluate((el) => getComputedStyle(el).backgroundColor))
			.toBe('rgb(255, 255, 255)');
	});

	test('the popover closes on Escape, on an outside tap, and when an option is chosen', async ({ page }) => {
		await seed(page);
		await page.goto('/');
		const menu = page.getByRole('menu', { name: 'Criar conteúdo' });
		await page.getByRole('button', { name: 'Criar conteúdo' }).click();
		await expect(menu).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(menu).toBeHidden();
		await page.getByRole('button', { name: 'Criar conteúdo' }).click();
		await page.getByRole('heading', { name: 'Minha coleção' }).click();
		await expect(menu).toBeHidden();
		await page.getByRole('button', { name: 'Criar conteúdo' }).click();
		await menu.getByRole('menuitem', { name: 'Colar link' }).click();
		await expect(page).toHaveURL(/\/add$/);
		await page.goBack();
		await page.getByRole('button', { name: 'Criar conteúdo' }).click();
		await menu.getByRole('menuitem', { name: 'Nova coleção' }).click();
		await expect(page).toHaveURL(/\/c\/new$/);
	});

	test('an empty collection is a plain card without the three placeholder tiles', async ({ page }) => {
		await seed(page);
		await page.goto('/c/new');
		await fillField(page.getByLabel('Nome da coleção'), 'Teste');
		await page.getByRole('button', { name: 'Criar coleção' }).click();
		await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
		await page.goto('/');
		const card = page.locator('a.card').filter({ has: page.getByRole('heading', { name: 'Teste', exact: true }) });
		await expect(card).toContainText('0 vídeos');
		await expect(card.locator('.fan, .tile')).toHaveCount(0);
		// the library card that has videos still fans them
		await expect(page.locator('a.card[data-collection="todos"] .tile').first()).toBeVisible();
	});

	test('empty Todos shows the collection illustration and both actions', async ({ page }) => {
		await mockNetwork(page);
		await page.goto('/c/todos');
		await expect(page.locator('svg.illustration[data-kind="collection"]')).toBeVisible();
		await expect(page.getByRole('link', { name: 'Colar um link' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Nova coleção' })).toBeVisible();
	});

	test('the back-to-top arrow shows deep in a long page and scrolls up', async ({ page }) => {
		await seed(page);
		await page.goto('/');
		await page.locator('main.library').evaluate((el: HTMLElement) => (el.style.minHeight = '4000px')); // style attribute: the policy refuses <style> tags
		const up = page.getByRole('button', { name: 'Voltar ao topo' });
		await expect(up).toHaveCount(0);
		await expect(async () => {
			await page.evaluate(() => window.scrollTo(0, 3000));
			await expect(up).toBeVisible({ timeout: 500 });
		}).toPass();
		await up.click();
		await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
		await expect(up).toHaveCount(0);
	});

	test('the back-to-top arrow also exists on a long collection and clears the Assistir button', async ({ page }) => {
		await seed(page);
		await page.goto('/c/todos');
		await page.locator('main.collection').evaluate((el: HTMLElement) => (el.style.minHeight = '4000px')); // style attribute: the policy refuses <style> tags
		const up = page.getByRole('button', { name: 'Voltar ao topo' });
		await expect(async () => {
			await page.evaluate(() => window.scrollTo(0, 3000));
			await expect(up).toBeVisible({ timeout: 500 });
		}).toPass();
		const [u, c] = await Promise.all([up.boundingBox(), page.locator('a.cta').boundingBox()]);
		const overlap = !(u!.x + u!.width <= c!.x || c!.x + c!.width <= u!.x || u!.y + u!.height <= c!.y || c!.y + c!.height <= u!.y);
		expect(overlap).toBe(false);
	});
});

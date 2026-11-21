import { expect, test, type Page } from '@playwright/test';
import { fillField, mockNetwork, paste } from './e2e-helpers';

// QA round 4 (owner's iPhone recordings, 2026-11-21). Written red first: each test
// pins one finding of docs/qa/QA-ROUND-4.md and must fail on the code of main.

async function seed(page: Page, link = 'https://youtu.be/dQw4w9WgXcQ') {
	await mockNetwork(page);
	await paste(page, link);
	await expect(page).toHaveURL(/\/v\//);
}

const SHORT = 'https://www.youtube.com/shorts/aBcDeFgHiJ0';

test.describe('R4.4 the picture sits in the middle of its space', () => {
	for (const [name, link] of [
		['horizontal video', 'https://youtu.be/dQw4w9WgXcQ'],
		['vertical video', SHORT]
	] as const) {
		test(`${name}: equal room above and below, centered across`, async ({ page }) => {
			await seed(page, link);
			const screen = page.locator('.screen');
			const frame = page.locator('.frame');
			await expect(frame).toBeVisible();
			const s = (await screen.boundingBox())!;
			const f = (await frame.boundingBox())!;
			const above = f.y - s.y;
			const below = s.y + s.height - (f.y + f.height);
			expect(Math.abs(above - below), `above ${above} / below ${below}`).toBeLessThanOrEqual(24);
			const side = Math.abs(f.x + f.width / 2 - (s.x + s.width / 2));
			expect(side).toBeLessThanOrEqual(2);
		});
	}
});

// iOS asks for motion access only from a tap. Once the person has said "on" the app
// used to ask again on the first tap of every launch, wherever that tap landed.
test.describe('R4.3 the motion question is asked only from its own switch', () => {
	test.beforeEach(({}, info) => {
		test.skip(info.project.name === 'desktop', 'no touch: the mouse drives the tilt');
	});

	const stub = (page: Page, answer: 'granted' | 'denied') =>
		page.addInitScript((a) => {
			const w = window as unknown as { __asked: number };
			w.__asked = 0;
			(DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission = () => {
				w.__asked += 1;
				return Promise.resolve(a);
			};
		}, answer);
	const asked = (page: Page) => page.evaluate(() => (window as unknown as { __asked: number }).__asked);

	test('a saved "on" never opens the question from a random tap', async ({ page }) => {
		await stub(page, 'granted');
		await page.addInitScript(() => localStorage.setItem('octa.tilt', '1'));
		await seed(page);
		await page.goto('/');
		await page.getByRole('button', { name: 'Criar conteúdo' }).click();
		await page.mouse.click(2, 2);
		expect(await asked(page)).toBe(0);
	});

	test('the Organizar switch still asks, once', async ({ page }) => {
		await stub(page, 'granted');
		await seed(page);
		await page.goto('/');
		await page.getByRole('button', { name: 'Organizar', exact: true }).click();
		await page.getByRole('switch', { name: 'Mover com o celular' }).click();
		await expect(page.getByRole('switch', { name: 'Mover com o celular' })).toHaveAttribute('aria-checked', 'true');
		expect(await asked(page)).toBe(1);
	});

	test('a "no" is remembered across a reload', async ({ page }) => {
		await stub(page, 'denied');
		await seed(page);
		await page.goto('/');
		await page.getByRole('button', { name: 'Organizar', exact: true }).click();
		await page.getByRole('switch', { name: 'Mover com o celular' }).click();
		await expect(page.getByRole('switch', { name: 'Mover com o celular' })).toHaveAttribute('aria-checked', 'false');
		await page.reload();
		await page.mouse.click(2, 2);
		expect(await asked(page)).toBe(0);
	});
});

// A tap with no visible answer reads as "nothing happened" (owner's video B).
test.describe('R4.2 every control answers a press', () => {
	const paint = (page: Page, selector: string) =>
		page.locator(selector).first().evaluate((el) => {
			const c = getComputedStyle(el);
			return `${c.backgroundColor}|${c.opacity}|${c.transform}|${c.filter}|${c.boxShadow}`;
		});

	async function pressed(page: Page, selector: string) {
		const el = page.locator(selector).first();
		await expect(el).toBeVisible();
		await el.hover(); // waits until the control receives pointer events (a screen transition can still cover it)
		const before = await paint(page, selector);
		await page.mouse.down();
		const during = await paint(page, selector);
		await page.mouse.move(2, 2); // let go away from the control: no click, like a finger sliding off
		await page.mouse.up();
		return { before, during };
	}

	test('viewer actions change while pressed', async ({ page }) => {
		await seed(page);
		for (const label of ['Compartilhar', 'Mover', 'Curtir']) {
			const { before, during } = await pressed(page, `.actions button[aria-label="${label}"]`);
			expect(during, label).not.toBe(before);
		}
	});

	test('library and sheet buttons change while pressed', async ({ page }) => {
		await seed(page);
		await page.goto('/');
		const plus = await pressed(page, 'button[aria-label="Criar conteúdo"]');
		expect(plus.during).not.toBe(plus.before);
		await page.getByRole('button', { name: 'Organizar', exact: true }).click();
		const opt = await pressed(page, 'dialog.sheet[data-state="open"] .option');
		expect(opt.during).not.toBe(opt.before);
	});

	test('the add screen CTA changes while pressed', async ({ page }) => {
		await mockNetwork(page);
		await page.goto('/add');
		await fillField(page.getByLabel('Link do vídeo'), 'https://youtu.be/dQw4w9WgXcQ'); // empty, the button is disabled
		const cta = await pressed(page, 'button:has-text("Gerar player")');
		expect(cta.during).not.toBe(cta.before);
	});
});

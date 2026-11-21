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

// R4.7: a delete used to be final the moment it was confirmed.
test.describe('R4.7 Desfazer after deleting a video', () => {
	const toast = (page: Page) => page.locator('p.toast.shown[role="status"]');

	async function seedTwo(page: Page) {
		await seed(page);
		await paste(page, SHORT);
		await expect(page).toHaveURL(/\/v\//);
	}

	test('from the viewer: Desfazer brings the video back and opens it', async ({ page }) => {
		await seedTwo(page);
		const title = (await page.locator('.info h1').textContent())!;
		await page.getByRole('button', { name: 'Mais ações' }).click();
		await page.getByRole('button', { name: 'Apagar da biblioteca' }).click();
		await page.getByRole('button', { name: 'Apagar vídeo' }).click();
		await expect(toast(page)).toHaveText('Vídeo apagado');
		await page.getByRole('button', { name: 'Desfazer' }).click();
		await expect(page.locator('.info h1')).toHaveText(title);
		await page.goto('/c/todos');
		await expect(page.locator('ul.videos li')).toHaveCount(2);
	});

	test('from the collection list: Desfazer puts the row back', async ({ page }) => {
		await seedTwo(page);
		await page.goto('/c/todos');
		await expect(page.locator('ul.videos li')).toHaveCount(2);
		await page.getByRole('button', { name: 'Editar', exact: true }).click();
		await page.getByRole('button', { name: /^Apagar/ }).first().click();
		await page.getByRole('button', { name: 'Apagar vídeo' }).click();
		await expect(page.locator('ul.videos li')).toHaveCount(1);
		await page.getByRole('button', { name: 'Desfazer' }).click();
		await expect(page.locator('ul.videos li')).toHaveCount(2);
	});

	test('the notice stays about 6 s, longer than a plain one, then Desfazer is gone', async ({ page }) => {
		await seed(page);
		await page.getByRole('button', { name: 'Mais ações' }).click();
		await page.getByRole('button', { name: 'Apagar da biblioteca' }).click();
		await page.getByRole('button', { name: 'Apagar vídeo' }).click();
		await expect(page.getByRole('button', { name: 'Desfazer' })).toBeVisible();
		await page.waitForTimeout(4500);
		await expect(page.getByRole('button', { name: 'Desfazer' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Desfazer' })).toHaveCount(0, { timeout: 4000 });
	});
});

// R4.1: the API sleeps (Render free ≈ 50 s). The paste gives up after 4 s and saves a generic
// title; it used to stay generic for good. Now the viewer keeps asking and shows the answer.
test.describe('R4.1 slow capture', () => {
	test('opening the paste screen knocks on the API once', async ({ page }) => {
		const knocks: string[] = [];
		await mockNetwork(page);
		await page.route('**/api/healthz', (route) => {
			knocks.push(route.request().url());
			return route.fulfill({ status: 200, body: 'ok' });
		});
		await page.goto('/add');
		await expect.poll(() => knocks.length).toBe(1);
		await page.waitForTimeout(300);
		expect(knocks.length, 'one knock per open (the minute-long limit is unit-tested)').toBe(1);
	});

	test('a resolve slower than the paste timeout: saved at once, real title lands in the viewer', async ({ page }) => {
		await mockNetwork(page);
		let calls = 0;
		await page.route('**/api/v1/resolve', async (route) => {
			calls += 1;
			if (calls === 1) await new Promise((r) => setTimeout(r, 6500)); // asleep: the client gives up at 4 s
			const id = 'dQw4w9WgXcQ';
			await route
				.fulfill({
					json: {
						source: 'youtube',
						kind: 'video',
						id,
						canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
						embed: { type: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0`, aspect: '16:9' },
						title: 'Título que chegou depois',
						author: 'Casa Aberta',
						thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
						durationSec: null,
						health: 'alive',
						checkedAt: new Date().toISOString()
					}
				})
				.catch(() => {}); // the first request was already abandoned by the client
		});
		await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
		await expect(page).toHaveURL(/\/v\//, { timeout: 8000 });
		// the second answer arrives without leaving the screen
		await expect(page.locator('.info h1')).toHaveText('Título que chegou depois', { timeout: 10_000 });
		expect(calls).toBe(2);
	});

	test('a long wait says why instead of a bare "Gerando…"', async ({ page }) => {
		await mockNetwork(page);
		await page.route('**/api/v1/resolve', () => new Promise(() => {})); // never answers: the 4 s timer ends it
		await page.goto('/add');
		await page.getByLabel('Link do vídeo').fill('https://youtu.be/dQw4w9WgXcQ');
		await page.getByLabel('Link do vídeo').blur();
		await page.getByRole('button', { name: 'Gerar player' }).click();
		await expect(page.getByRole('button', { name: 'Gerando…' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Acordando o servidor…' })).toBeVisible({ timeout: 3800 });
	});
});

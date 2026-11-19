import { expect, test, type Page } from '@playwright/test';
import { mockNetwork, paste, fillField } from './e2e-helpers';

// Thumbnails are blocked by mockNetwork; serve flat color images so the 3D
// composition can be seen in screenshots and the image path is exercised.
async function withThumbnails(page: Page) {
	await mockNetwork(page);
	await page.route('https://i.ytimg.com/**', (route) => {
		const hue = route.request().url().includes('aBcDeFgHiJ0') ? 28 : 215;
		route.fulfill({
			contentType: 'image/svg+xml',
			body: `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="640"><rect width="480" height="640" fill="hsl(${hue} 70% 55%)"/><circle cx="240" cy="320" r="90" fill="rgba(255,255,255,.85)"/></svg>`
		});
	});
}

async function seed(page: Page) {
	await withThumbnails(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await expect(page).toHaveURL(/\/v\//);
	await paste(page, 'https://www.youtube.com/shorts/aBcDeFgHiJ0');
	await expect(page).toHaveURL(/\/v\//);
}

test('Library cards show a CSS-3D fan of bordered cards with the source on each', async ({ page }) => {
	await seed(page);
	await page.goto('/');
	const fan = page.locator('a.card[data-collection="todos"] .fan');
	await expect(fan.locator('.tile')).toHaveCount(2); // as many cards as videos (up to 5)
	expect(await fan.evaluate((el) => getComputedStyle(el).perspective)).not.toBe('none');
	const first = await fan.locator('.tile').first().evaluate((el) => getComputedStyle(el).transform);
	expect(first).not.toBe('none');
	// Newest first: the Short stands up and says SHORTS, the other lies down and says YOUTUBE.
	await expect(fan.locator('.tag')).toHaveText(['Shorts', 'YouTube']);
	await expect(fan.locator('.tile.vertical')).toHaveCount(1);
	expect(await fan.locator('.tag').first().evaluate((el) => getComputedStyle(el).textTransform)).toBe('uppercase');
	// The fan is decoration: nothing for a screen reader to read, and the card keeps its name.
	await expect(fan).toHaveAttribute('aria-hidden', 'true');
	await expect(page.getByRole('heading', { name: 'Todos', exact: true })).toBeVisible();
	// Name on top, fan, count below (prototype page 2).
	const card = page.locator('a.card[data-collection="todos"]');
	const title = (await card.getByRole('heading').boundingBox())!;
	const fanBox = (await fan.boundingBox())!;
	const count = (await card.locator('.count').boundingBox())!;
	expect(title.y).toBeLessThan(fanBox.y);
	expect(count.y).toBeGreaterThan(fanBox.y);
});

test('the Library header summarises collections and videos', async ({ page }) => {
	await seed(page);
	await page.goto('/');
	await expect(page.locator('header .heading p')).toHaveText('2 vídeos');
	await page.goto('/c/new');
	await fillField(page.getByLabel('Nome da coleção'), 'Música');
	await page.getByRole('button', { name: 'Criar coleção' }).click();
	await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
	await page.goto('/');
	await expect(page.locator('header .heading p')).toHaveText('1 coleção · 2 vídeos');
});

test('Collection screen shows tilted 3D screens: bezel, source, status, serif title (no play mark)', async ({ page }, testInfo) => {
	await seed(page);
	await page.goto('/c/todos');
	const list = page.locator('ul.videos');
	const screens = list.locator('.screen');
	await expect(screens).toHaveCount(2);
	expect(await list.locator('li').first().evaluate((el) => getComputedStyle(el).perspective)).not.toBe('none');
	// Each screen is posed in 3D and has thickness (stacked edge shadows). No play mark: that is for the player only.
	for (const i of [0, 1]) {
		const screen = screens.nth(i);
		expect(await screen.evaluate((el) => getComputedStyle(el).transform)).not.toBe('none');
		const shadow = await screen.evaluate((el) => getComputedStyle(el).boxShadow);
		expect((shadow.match(/rgb/g) ?? []).length).toBeGreaterThanOrEqual(4);
		await expect(screen.locator('.play')).toHaveCount(0);
	}
	// Newest first: Shorts, then YouTube. Known links say ATIVO.
	await expect(screens.locator('.src')).toHaveText(['Shorts', 'YouTube']);
	await expect(screens.locator('.status')).toHaveText(['Ativo', 'Ativo']);
	expect(await screens.locator('.src').first().evaluate((el) => getComputedStyle(el).textTransform)).toBe('uppercase');
	expect(await screens.locator('.name').first().evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Newsreader');
	await expect(page.locator('.count')).toHaveText('2 vídeos');
	// They overlap like a pile, and the lower one is in front.
	const first = (await screens.nth(0).boundingBox())!;
	const second = (await screens.nth(1).boundingBox())!;
	expect(second.y).toBeLessThan(first.y + first.height);
	const zs = await screens.evaluateAll((els) => els.map((el) => Number(getComputedStyle(el.closest('li')!).zIndex)));
	expect(zs[1]).toBeGreaterThan(zs[0]);
	// The old paper stack on top is gone: the screens are the 3D elements.
	await expect(page.locator('.stack')).toHaveCount(0);
	await page.waitForLoadState('networkidle');
	const dir = `test-results/slice2e2/${testInfo.project.name}`;
	await page.screenshot({ path: `${dir}-collection.png`, fullPage: true });
});

test('with many videos the Assistir em sequência button stays in front of the pile', async ({ page }) => {
	await mockNetwork(page);
	// Distinct videos, so the list is long enough to scroll under the sticky button.
	await page.route('**/api/v1/resolve', async (route) => {
		const { url } = route.request().postDataJSON() as { url: string };
		const id = url.split('/').pop()!.padEnd(11, 'x').slice(0, 11);
		await route.fulfill({
			json: {
				source: 'youtube',
				kind: 'video',
				id,
				canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
				embed: { type: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}`, aspect: '16:9' },
				title: `Vídeo ${id}`,
				health: 'alive',
				checkedAt: '2026-11-19T12:00:00Z'
			}
		});
	});
	for (const id of ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc', 'ddddddddddd', 'eeeeeeeeeee', 'fffffffffff']) {
		await paste(page, `https://youtu.be/${id}`);
		await expect(page).toHaveURL(/\/v\//);
	}
	await page.goto('/c/todos');
	await expect(page.locator('.screen')).toHaveCount(6);
	for (const where of ['bottom', 'middle']) {
		await page.evaluate((w) => window.scrollTo(0, w === 'bottom' ? document.body.scrollHeight : document.body.scrollHeight / 2), where);
		await page.waitForTimeout(300);
		const cta = page.getByRole('link', { name: 'Assistir em sequência' });
		const box = (await cta.boundingBox())!;
		const hit = await page.evaluate(
			([x, y]) => document.elementFromPoint(x, y)?.closest('a.cta') !== null,
			[box.x + box.width / 2, box.y + box.height / 2]
		);
		expect(hit, `button covered at scroll ${where}`).toBe(true);
	}
});

test('a link known to be dead says FORA DO AR and the header counts it', async ({ page }) => {
	await seed(page);
	await page.route('**/api/v1/resolve', async (route) => {
		const { url } = route.request().postDataJSON() as { url: string };
		const short = url.includes('/shorts/');
		await route.fulfill({
			json: {
				source: 'youtube',
				kind: short ? 'short' : 'video',
				id: 'zZzZzZzZzZz',
				canonicalUrl: 'https://www.youtube.com/watch?v=zZzZzZzZzZz',
				embed: { type: 'iframe', src: 'https://www.youtube-nocookie.com/embed/zZzZzZzZzZz', aspect: '16:9' },
				title: 'Link caído',
				durationSec: 3723,
				health: 'dead',
				checkedAt: '2026-11-19T12:00:00Z'
			}
		});
	});
	await paste(page, 'https://youtu.be/zZzZzZzZzZz');
	await expect(page).toHaveURL(/\/v\//);
	await page.goto('/c/todos');
	await expect(page.locator('.screen .status.dead')).toHaveText('Fora do ar');
	await expect(page.locator('.screen .status.dead')).toHaveCount(1);
	await expect(page.locator('.count')).toHaveText('3 vídeos · 1 fora do ar');
	// The length is printed next to the source.
	await expect(page.locator('.screen .meta').first()).toContainText('1:02:03');
});

test('editing flattens the pile so Mover is easy to hit, and Concluído puts it back', async ({ page }) => {
	await seed(page);
	await page.goto('/c/todos');
	const screen = page.locator('.screen').first();
	await page.getByRole('button', { name: 'Editar' }).click();
	// The pose eases out over a few hundred ms, so wait for the end of it.
	await expect.poll(() => screen.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
	await expect(page.getByRole('button', { name: /^Mover/ })).toHaveCount(2);
	const a = (await page.locator('.screen').nth(0).boundingBox())!;
	const b = (await page.locator('.screen').nth(1).boundingBox())!;
	expect(b.y).toBeGreaterThanOrEqual(a.y + a.height - 1);
	await page.getByRole('button', { name: 'Concluído' }).click();
	await expect.poll(() => screen.evaluate((el) => getComputedStyle(el).transform)).not.toBe('none');
});

test('an empty collection has no screens', async ({ page }) => {
	await mockNetwork(page);
	await page.goto('/c/new');
	await fillField(page.getByLabel('Nome da coleção'), 'Vazia');
	await page.getByRole('button', { name: 'Criar coleção' }).click();
	await expect(page.getByRole('heading', { name: 'Vazia' })).toBeVisible();
	await expect(page.locator('.screen')).toHaveCount(0);
});

test('reduced motion: screens keep their pose but nothing animates', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await seed(page);
	await page.goto('/c/todos');
	const screen = page.locator('.screen').first();
	const seconds = await screen.evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration));
	expect(seconds).toBeLessThan(0.001);
	const before = await screen.evaluate((el) => getComputedStyle(el).transform);
	expect(before).not.toBe('none');
	await screen.hover();
	expect(await screen.evaluate((el) => getComputedStyle(el).transform)).toBe(before);
});

test('without reduced motion, hovering a screen lifts it toward the viewer', async ({ page }, testInfo) => {
	test.skip(testInfo.project.name !== 'desktop', 'hover needs a pointer');
	await seed(page);
	await page.goto('/c/todos');
	const screen = page.locator('.screen').first();
	const before = await screen.evaluate((el) => getComputedStyle(el).transform);
	await screen.hover();
	await expect.poll(() => screen.evaluate((el) => getComputedStyle(el).transform)).not.toBe(before);
});

test('reduced motion: the fan keeps its pose but nothing animates', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await seed(page);
	await page.goto('/');
	const paper = page.locator('a.card[data-collection="todos"] .fan .tile').first();
	// A global reduced-motion rule may set 1e-5s instead of 0s; both mean "instant".
	const seconds = await paper.evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration));
	expect(seconds).toBeLessThan(0.001);
	const before = await paper.evaluate((el) => getComputedStyle(el).transform);
	await page.locator('a.card[data-collection="todos"]').hover();
	expect(await paper.evaluate((el) => getComputedStyle(el).transform)).toBe(before);
});

test('without reduced motion, hovering a card fans the papers wider', async ({ page }, testInfo) => {
	test.skip(testInfo.project.name !== 'desktop', 'hover needs a pointer');
	await seed(page);
	await page.goto('/');
	const paper = page.locator('a.card[data-collection="todos"] .fan .tile').first();
	const before = await paper.evaluate((el) => getComputedStyle(el).transform);
	await page.locator('a.card[data-collection="todos"]').hover();
	await expect
		.poll(() => paper.evaluate((el) => getComputedStyle(el).transform))
		.not.toBe(before);
});

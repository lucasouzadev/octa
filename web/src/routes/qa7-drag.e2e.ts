import { expect, test, type Page } from '@playwright/test';
import { mockNetwork, paste } from './e2e-helpers';

// R7.1: the Reordenar drag stalled halfway on the phone. The lifted row must stay under the finger
// the whole way, across every slot it passes, and the drag must not end before the finger lifts.

async function seed(page: Page, names: string[]) {
	await mockNetwork(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await expect(page).toHaveURL(/\/v\//);
	for (const n of names) {
		await page.goto('/c/new');
		await page.getByLabel('Nome da coleção').fill(n);
		await page.getByRole('button', { name: 'Criar coleção' }).click();
		await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
	}
	await page.goto('/');
	await page.getByRole('button', { name: 'Organizar', exact: true }).click();
	await page.getByRole('button', { name: 'Reordenar coleções' }).click();
	await expect(page.locator('dialog.sheet[open]')).toHaveCount(0);
}

test.describe('R7.1 the drag follows the finger all the way', () => {
	test.use({ hasTouch: true });

	test('a real touch drag keeps the lifted row under the finger, down and back up', async ({ page, browserName }) => {
		test.skip(browserName !== 'chromium', 'touch is driven through CDP');
		await seed(page, ['A', 'B', 'C', 'D', 'E', 'F']);
		const cdp = await page.context().newCDPSession(page);
		const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
			cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
		const start = (await page.getByRole('button', { name: 'Mover A' }).boundingBox())!;
		const x = start.x + start.width / 2;
		const y0 = start.y + start.height / 2;
		const last = (await page.getByRole('button', { name: 'Mover F' }).boundingBox())!;
		const y1 = last.y + last.height / 2;
		await touch('touchStart', x, y0);
		const path = [
			...Array.from({ length: 30 }, (_, i) => y0 + ((y1 - y0) * (i + 1)) / 30),
			...Array.from({ length: 30 }, (_, i) => y1 - ((y1 - y0) * (i + 1)) / 30)
		];
		const drift: number[] = [];
		for (const y of path) {
			await touch('touchMove', x, y);
			await page.waitForTimeout(16);
			const lifted = page.locator('li.lifted');
			expect(await lifted.count(), `drag ended early at y=${Math.round(y)}`).toBe(1);
			const b = (await lifted.boundingBox())!;
			drift.push(Math.abs(b.y + b.height / 2 - y));
		}
		await touch('touchEnd', x, y0);
		expect(Math.max(...drift), 'lifted row strays from the finger').toBeLessThan(6);
	});

	test('the lifted row stays under the pointer at every step, down and back up', async ({ page }) => {
		await seed(page, ['A', 'B', 'C', 'D', 'E', 'F']);
		const handle = page.getByRole('button', { name: 'Mover A' });
		const start = (await handle.boundingBox())!;
		const x = start.x + start.width / 2;
		const y0 = start.y + start.height / 2;
		const last = (await page.getByRole('button', { name: 'Mover F' }).boundingBox())!;
		const y1 = last.y + last.height / 2;
		await page.mouse.move(x, y0);
		await page.mouse.down();
		const drift: number[] = [];
		const path = [
			...Array.from({ length: 30 }, (_, i) => y0 + ((y1 - y0) * (i + 1)) / 30),
			...Array.from({ length: 30 }, (_, i) => y1 - ((y1 - y0) * (i + 1)) / 30)
		];
		for (const y of path) {
			await page.mouse.move(x, y);
			await page.waitForTimeout(16);
			const lifted = page.locator('li.lifted');
			expect(await lifted.count(), `drag ended early at y=${Math.round(y)}`).toBe(1);
			const b = (await lifted.boundingBox())!;
			drift.push(Math.abs(b.y + b.height / 2 - y));
		}
		await page.mouse.up();
		expect(Math.max(...drift), 'lifted row strays from the pointer').toBeLessThan(6);
	});

	test('the rows stay in their DOM order until the finger lifts (moving the touched node ends a touch on iOS)', async ({ page }) => {
		await seed(page, ['A', 'B', 'C', 'D']);
		const domOrder = () => page.locator('li[data-mine] .rname').allInnerTexts();
		const before = await domOrder();
		const start = (await page.getByRole('button', { name: 'Mover A' }).boundingBox())!;
		const last = (await page.getByRole('button', { name: 'Mover D' }).boundingBox())!;
		const x = start.x + start.width / 2;
		await page.mouse.move(x, start.y + start.height / 2);
		await page.mouse.down();
		await page.mouse.move(x, last.y + last.height / 2, { steps: 20 });
		await expect(page.locator('li.lifted')).toHaveCount(1);
		expect(await domOrder(), 'the list was reordered under the finger').toEqual(before);
		await page.mouse.up();
		await expect.poll(domOrder).toEqual(['Todos', 'B', 'C', 'D', 'A'].filter((n) => n !== 'Todos' || before.includes('Todos')));
	});
});

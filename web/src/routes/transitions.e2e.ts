import { expect, test, type Page } from '@playwright/test';
import { mockNetwork, paste } from './e2e-helpers';

type Call = { mode: string | undefined; named: boolean };

// Wrap startViewTransition so each call records the mode and whether a thumbnail
// carried the shared name at that moment. Playwright cannot watch the animation.
async function spy(page: Page) {
	await page.addInitScript(() => {
		const w = window as unknown as { __vt: unknown[] };
		w.__vt = [];
		const original = document.startViewTransition?.bind(document);
		if (!original) return;
		document.startViewTransition = ((cb: () => Promise<void>) => {
			w.__vt.push({
				mode: document.documentElement.dataset.vt,
				named: [...document.querySelectorAll<HTMLElement>('.thumb')].some(
					(el) => el.style.viewTransitionName === 'thumb'
				)
			});
			return original(cb);
		}) as typeof document.startViewTransition;
	});
}

const calls = (page: Page) => page.evaluate(() => (window as unknown as { __vt: Call[] }).__vt);

async function seed(page: Page) {
	await mockNetwork(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await expect(page).toHaveURL(/\/v\//);
}

test('opening a video from a list runs the full transition and names its thumbnail', async ({ page }) => {
	await spy(page);
	await seed(page);
	await page.goto('/c/todos');
	await page.locator('a.row').first().click();
	await expect(page).toHaveURL(/\/v\//);
	const last = (await calls(page)).at(-1);
	expect(last).toEqual({ mode: 'full', named: true });
	// Nothing is left behind once the transition ends.
	await expect(page.locator('html')).not.toHaveAttribute('data-vt', /.+/);
});

test('reduced motion gets a short fade and no shared-element morph', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await spy(page);
	await seed(page);
	await page.goto('/c/todos');
	await page.locator('a.row').first().click();
	await expect(page).toHaveURL(/\/v\//);
	const last = (await calls(page)).at(-1);
	expect(last).toEqual({ mode: 'fade', named: false });
	const name = await page.locator('.player .frame').evaluate((el) => getComputedStyle(el).viewTransitionName);
	expect(name).toBe('none');
});

test('without View Transitions the navigation still works', async ({ page }) => {
	await page.addInitScript(() => {
		// @ts-expect-error simulate an older browser
		document.startViewTransition = undefined;
	});
	await seed(page);
	await page.goto('/c/todos');
	await page.locator('a.row').first().click();
	await expect(page).toHaveURL(/\/v\//);
	await expect(page.locator('.player .frame')).toBeVisible();
	await page.getByRole('link', { name: 'Fechar' }).click();
	await expect(page).toHaveURL(/\/c\/todos$/); // "Fechar" returns to the scope it came from
});

test('the tapped thumbnail is the only element holding the shared name', async ({ page }) => {
	await seed(page);
	await paste(page, 'https://www.youtube.com/shorts/aBcDeFgHiJ0');
	await expect(page).toHaveURL(/\/v\//);
	await page.goto('/c/todos');
	await expect(page.locator('a.row')).toHaveCount(2);
	await page.evaluate(() => {
		document.querySelectorAll('a.row').forEach((a) => a.addEventListener('click', (e) => e.preventDefault(), { capture: false }));
	});
	await page.locator('a.row').nth(1).click();
	const named = await page.locator('.thumb').evaluateAll(
		(els) => els.map((el) => (el as HTMLElement).style.viewTransitionName)
	);
	expect(named).toEqual(['', 'thumb']);
});

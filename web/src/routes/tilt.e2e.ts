import { expect, test, type Page } from '@playwright/test';
import { mockNetwork, paste } from './e2e-helpers';

// The 3D objects lean with the phone (the touch counterpart of the mouse). Headless
// Chromium has no sensor, so the readings are dispatched by hand; the real sensor and
// the iOS permission question can only be proven on a device.

async function seed(page: Page) {
	await mockNetwork(page);
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await expect(page).toHaveURL(/\/v\//);
}

/** A held pose: the first reading is the rest pose, then `count` readings at the new angle. */
async function lean(page: Page, beta: number, gamma: number, count = 40) {
	await page.evaluate(
		({ beta, gamma, count }) => {
			const fire = (b: number, g: number) => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { beta: b, gamma: g }));
			fire(45, 0);
			for (let i = 0; i < count; i++) fire(beta, gamma);
		},
		{ beta, gamma, count }
	);
}

const tiltVar = (page: Page, name: '--tilt-x' | '--tilt-y') =>
	page.evaluate((n) => parseFloat(document.documentElement.style.getPropertyValue(n) || '0'), name);

// Platforms differ: iOS (and recent Chrome) have a permission question, older Android has none.
const askAnswers = (page: Page, answer: 'granted' | 'denied') =>
	page.addInitScript((a) => {
		(DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission = () => {
			(window as unknown as { __asked: number }).__asked = ((window as unknown as { __asked?: number }).__asked ?? 0) + 1;
			return Promise.resolve(a);
		};
	}, answer);

const noPermissionApi = (page: Page) =>
	page.addInitScript(() => {
		delete (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission;
	});

/** The person turns it on, on a platform that asks. */
async function turnOn(page: Page) {
	await askAnswers(page, 'granted');
	await seed(page);
	await page.goto('/');
	await sw(page).click();
	await expect(sw(page)).toHaveAttribute('aria-pressed', 'true');
}

/** After a full reload iOS asks again, and only from a tap: the first tap anywhere does it. */
async function retap(page: Page) {
	// The page may still be hydrating: tap until the app has taken the tap.
	await expect(async () => {
		await page.mouse.click(2, 2);
		await expect(page.locator('html')).toHaveAttribute('data-tilt', 'on', { timeout: 500 });
	}).toPass({ timeout: 8000 });
}

const sw = (page: Page) => page.getByRole('button', { name: 'Mover com o celular' });

test.describe('R4 tilt follows the phone', () => {
	test.beforeEach(({}, info) => {
		test.skip(info.project.name === 'desktop', 'no touch: the mouse drives the tilt');
	});

	test('with no permission question (older Android) it is on by default', async ({ page }) => {
		await noPermissionApi(page);
		await seed(page);
		await page.goto('/');
		await expect(sw(page)).toBeVisible();
		await expect(sw(page)).toHaveAttribute('aria-pressed', 'true');
		await expect(page.locator('html')).toHaveAttribute('data-tilt', 'on');
	});

	test('leaning the phone moves the pose and it is clamped to -1..1', async ({ page }) => {
		await turnOn(page);
		await lean(page, 45, 30);
		expect(await tiltVar(page, '--tilt-x')).toBeGreaterThan(0.5);
		await lean(page, 45, 170);
		expect(await tiltVar(page, '--tilt-x')).toBeLessThanOrEqual(1);
		await lean(page, 45 + 22, 0);
		expect(await tiltVar(page, '--tilt-y')).toBeGreaterThan(0.5);
	});

	test('the CSS screens on the collection lean with it', async ({ page }) => {
		await turnOn(page);
		await page.goto('/c/todos');
		await retap(page);
		const screen = page.locator('.videos li a').first();
		await expect(screen).toBeVisible();
		const at = (b: number, g: number) => lean(page, b, g).then(() => screen.evaluate((el) => getComputedStyle(el).transform));
		const left = await at(45, -25);
		const right = await at(45, 25);
		expect(left).not.toBe('none');
		expect(left).not.toBe(right);
	});

	test('the Library fan leans with it too', async ({ page }) => {
		await turnOn(page);
		const tile = page.locator('.fan .tile').first();
		await expect(tile).toBeVisible();
		const at = (g: number) => lean(page, 45, g).then(() => tile.evaluate((el) => getComputedStyle(el).transform));
		expect(await at(-25)).not.toBe(await at(25));
	});

	test('turning it off stops the lean, resets the pose and stays off after a reload', async ({ page }) => {
		await turnOn(page);
		await lean(page, 45, 30);
		expect(await tiltVar(page, '--tilt-x')).toBeGreaterThan(0.3);
		await sw(page).click();
		await expect(sw(page)).toHaveAttribute('aria-pressed', 'false');
		await expect(page.locator('html')).not.toHaveAttribute('data-tilt', 'on');
		expect(await tiltVar(page, '--tilt-x')).toBe(0);
		await lean(page, 45, 30);
		expect(await tiltVar(page, '--tilt-x')).toBe(0);
		await page.reload();
		await expect(sw(page)).toHaveAttribute('aria-pressed', 'false');
	});

	test('with reduced motion there is no switch and no lean', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await seed(page);
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Buscar vídeos' })).toBeVisible();
		await expect(sw(page)).toHaveCount(0);
		await lean(page, 45, 30);
		expect(await tiltVar(page, '--tilt-x')).toBe(0);
	});

	test('a hidden page stops listening', async ({ page }) => {
		await turnOn(page);
		await page.evaluate(() => {
			Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
			document.dispatchEvent(new Event('visibilitychange'));
		});
		await lean(page, 45, 30);
		expect(await tiltVar(page, '--tilt-x')).toBe(0);
	});
});

test.describe('R4 iOS asks permission from the tap', () => {
	test.beforeEach(({}, info) => {
		test.skip(info.project.name === 'desktop', 'no touch');
	});

	test('it starts off, and the tap on the switch is what asks', async ({ page }) => {
		await askAnswers(page, 'granted');
		await seed(page);
		await page.goto('/');
		await expect(sw(page)).toHaveAttribute('aria-pressed', 'false');
		expect(await page.evaluate(() => (window as unknown as { __asked?: number }).__asked ?? 0)).toBe(0);
		await sw(page).click();
		await expect(sw(page)).toHaveAttribute('aria-pressed', 'true');
		expect(await page.evaluate(() => (window as unknown as { __asked: number }).__asked)).toBe(1);
		await lean(page, 45, 30);
		expect(await tiltVar(page, '--tilt-x')).toBeGreaterThan(0.3);
	});

	test('a refusal leaves it off and nothing moves', async ({ page }) => {
		await askAnswers(page, 'denied');
		await seed(page);
		await page.goto('/');
		await sw(page).click();
		await expect(sw(page)).toHaveAttribute('aria-pressed', 'false');
		await lean(page, 45, 30);
		expect(await tiltVar(page, '--tilt-x')).toBe(0);
	});
});

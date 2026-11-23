import { expect, test, type Page } from '@playwright/test';
import { fakeYouTube, mockNetwork, paste, patchVideo, readVideo, type NetworkOptions } from './e2e-helpers';

// Slice 3b: link health on the device (SPEC §5).
const HOUR = 3_600_000;

async function seed(page: Page, health?: NetworkOptions['health']) {
	const net = await mockNetwork(page, { health });
	await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
	await expect(page).toHaveURL(/\/v\//);
	return net;
}

const ago = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();

test.describe('link health (slice 3b)', () => {
	test('opening the library checks a stale link and marks the card once it is dead', async ({ page }) => {
		const net = await seed(page, () => 'dead');
		await patchVideo(page, { checkedAt: ago(30) });
		await page.goto('/');
		await expect.poll(async () => (await readVideo(page)).health).toBe('dead');
		expect((await readVideo(page)).deadStreak).toBe(1);
		expect(net.healthCalls.length).toBeGreaterThan(0);
		await page.goto('/c/todos');
		await expect(page.getByText('Fora do ar').first()).toBeVisible();
		await expect(page.getByRole('alertdialog')).toHaveCount(0); // one failure only marks the card
	});

	test('a link checked a few hours ago is not checked again', async ({ page }) => {
		const net = await seed(page, () => 'dead');
		await patchVideo(page, { checkedAt: ago(2) });
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Todos' }).first()).toBeVisible();
		await page.waitForTimeout(400);
		expect(net.healthCalls).toHaveLength(0);
		expect((await readVideo(page)).health).toBe('alive');
	});

	test('a blocked check (unknown) never overwrites a good link', async ({ page }) => {
		await seed(page); // default answer: unknown
		await patchVideo(page, { checkedAt: ago(30) });
		await page.goto('/');
		await page.waitForTimeout(400);
		expect((await readVideo(page)).health).toBe('alive');
	});

	test('before playing, a stale link is checked and a second dead answer opens the orange screen', async ({ page }) => {
		await seed(page, () => 'dead');
		await patchVideo(page, { health: 'dead', deadStreak: 1, checkedAt: ago(25) });
		await page.goto(page.url());
		await expect(page.getByRole('alertdialog').getByRole('heading')).toHaveText('Esse vídeo saiu do ar.');
		expect((await readVideo(page)).deadStreak).toBe(2);
	});

	test('a dead mark with a streak of 1 never opens the orange screen', async ({ page }) => {
		await seed(page, () => 'dead');
		await patchVideo(page, { health: 'dead', deadStreak: 1, checkedAt: ago(25) });
		await page.goto('/'); // sweep: second dead answer 25 h later counts -> streak 2
		await expect.poll(async () => (await readVideo(page)).deadStreak).toBe(2);
		await patchVideo(page, { deadStreak: 1, checkedAt: ago(0.5) });
		await page.goto(page.url());
		await page.goto('/c/todos');
		await expect(page.getByRole('alertdialog')).toHaveCount(0);
	});

	test('"Manter e checar de novo" asks the API again, fresh, and an alive answer clears the mark', async ({ page }) => {
		const net = await seed(page, (c) => (c.fresh ? 'alive' : 'dead'));
		const url = page.url();
		await patchVideo(page, { health: 'dead', deadStreak: 2, checkedAt: ago(1) });
		await page.goto(url);
		const screen = page.getByRole('alertdialog');
		await expect(screen.getByRole('heading')).toHaveText('Esse vídeo saiu do ar.');
		await screen.getByRole('button', { name: 'Manter e checar de novo' }).click();
		await expect(screen).toHaveCount(0);
		await expect.poll(async () => (await readVideo(page)).health).toBe('alive');
		expect((await readVideo(page)).deadStreak).toBe(0);
		expect(net.healthCalls.some((c) => c.fresh)).toBe(true);
	});

	test('the API being down never blocks playback or marks anything dead', async ({ page }) => {
		await mockNetwork(page, { apiDown: true });
		await fakeYouTube(page);
		await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
		await expect(page).toHaveURL(/\/v\//);
		await patchVideo(page, { checkedAt: ago(30) });
		await page.goto(page.url());
		await expect(page.locator('.player iframe, .player video')).toHaveCount(1);
		await expect(page.getByRole('alertdialog')).toHaveCount(0);
		expect((await readVideo(page)).health).not.toBe('dead');
	});
});

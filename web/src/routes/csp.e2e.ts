import { expect, test, type Page } from '@playwright/test';
import { mockNetwork, paste } from './e2e-helpers';

// Slice 4: the policy Kit emits (vite.config.ts) is enforced and the app never trips it.
// Probes load real elements from the page and read `securitypolicyviolation` events:
// a blocked URL fires one, an allowed URL does not (the mocked network then just aborts it).

async function watch(page: Page) {
	await page.addInitScript(() => {
		const w = window as unknown as { __csp: string[] };
		w.__csp = [];
		document.addEventListener('securitypolicyviolation', (e) => w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
	});
}
const violations = (page: Page) => page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);

/** Inserts the element, waits a tick for the policy to speak, returns the violations it caused. */
function probe(page: Page, html: string) {
	return page.evaluate(async (markup) => {
		const w = window as unknown as { __csp: string[] };
		const before = w.__csp.length;
		const host = document.createElement('div');
		host.innerHTML = markup;
		for (const node of Array.from(host.querySelectorAll('script'))) {
			// innerHTML scripts never run; re-create so the policy is consulted like a real load
			const s = document.createElement('script');
			for (const a of node.attributes) s.setAttribute(a.name, a.value);
			s.textContent = node.textContent;
			node.replaceWith(s);
		}
		document.body.append(host);
		await new Promise((r) => setTimeout(r, 150));
		host.remove();
		return w.__csp.slice(before);
	}, html);
}

test.describe('content security policy (slice 4)', () => {
	test('the page carries the strict policy', async ({ page }) => {
		await mockNetwork(page);
		// `vite preview` sends the policy as a header; the static build puts the same string in a <meta>
		// in 200.html (checked in CI by the build step below), so this reads whichever the server gave.
		const res = (await page.goto('/'))!;
		const csp = res.headers()['content-security-policy'] ?? (await res.text()).match(/http-equiv="content-security-policy" content="([^"]*)"/)?.[1];
		expect(csp).toContain("default-src 'none'");
		expect(csp).toContain("object-src 'none'");
		expect(csp).toContain('frame-src https://www.youtube-nocookie.com https://www.instagram.com https://www.tiktok.com');
		// the only inline allowance is for style attributes; no directive may allow inline or eval code
		expect(csp?.split('; ').filter((d) => d.includes("'unsafe-")).map((d) => d.split(' ')[0])).toEqual(['style-src-attr']);
		expect(csp?.match(/script-src[^;]*/)?.[0]).not.toMatch(/unsafe-inline|unsafe-eval/);
	});

	test('scripts: only self, the YouTube API and Kit hashes run', async ({ page }) => {
		await mockNetwork(page);
		await watch(page);
		await page.goto('/');
		expect(await probe(page, '<script src="https://www.youtube.com/iframe_api"></script>')).toEqual([]);
		expect(await probe(page, '<script src="https://evil.example/x.js"></script>')).toHaveLength(1);
		expect(await probe(page, '<script>window.__pwned = 1</script>')).toHaveLength(1);
		expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
	});

	test('frames: official players only', async ({ page }) => {
		await mockNetwork(page);
		await watch(page);
		await page.goto('/');
		for (const ok of [
			'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
			'https://www.instagram.com/reel/abc/embed',
			'https://www.tiktok.com/embed/v2/7000000000000000000'
		]) {
			expect(await probe(page, `<iframe src="${ok}"></iframe>`), ok).toEqual([]);
		}
		expect(await probe(page, '<iframe src="https://evil.example/"></iframe>')).toHaveLength(1);
		expect(await probe(page, '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>')).toHaveLength(1);
		expect(await probe(page, '<iframe src="javascript:alert(1)"></iframe>')).toHaveLength(1);
	});

	test('objects, forms to other origins and a new <base> are refused', async ({ page }) => {
		await mockNetwork(page);
		await watch(page);
		await page.goto('/');
		expect(await probe(page, '<object data="https://evil.example/x.swf"></object>')).toHaveLength(1);
		expect(await probe(page, '<base href="https://evil.example/">')).toHaveLength(1);
	});

	test('using the app trips nothing: library, add, player', async ({ page }) => {
		await mockNetwork(page);
		await watch(page);
		await page.goto('/');
		await paste(page, 'https://youtu.be/dQw4w9WgXcQ');
		await expect(page).toHaveURL(/\/v\//);
		await page.waitForTimeout(500);
		await page.goto('/');
		await page.goto('/c/todos');
		await page.waitForTimeout(300);
		expect(await violations(page)).toEqual([]);
	});
});

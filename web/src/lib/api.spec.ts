import { describe, expect, it } from 'vitest';

describe('warmUp (R4.1)', () => {
	it('knocks once on /healthz without reading the answer, then waits a minute', async () => {
		const { warmUp } = await import('#lib/api.ts');
		const calls: [string, RequestInit | undefined][] = [];
		const fake = ((u: string, init?: RequestInit) => {
			calls.push([u, init]);
			return Promise.resolve(new Response(''));
		}) as unknown as typeof fetch;
		const t0 = 10_000_000;
		warmUp({ fetch: fake, base: 'https://api.test', now: t0 });
		warmUp({ fetch: fake, base: 'https://api.test', now: t0 + 30_000 });
		expect(calls.map((c) => c[0])).toEqual(['https://api.test/healthz']);
		expect(calls[0][1]?.mode).toBe('no-cors');
		warmUp({ fetch: fake, base: 'https://api.test', now: t0 + 61_000 });
		expect(calls).toHaveLength(2);
	});

	it('never throws when the API is down', async () => {
		const { warmUp } = await import('#lib/api.ts');
		const down = (() => Promise.reject(new TypeError('offline'))) as unknown as typeof fetch;
		expect(() => warmUp({ fetch: down, now: 99_000_000 })).not.toThrow();
	});
});

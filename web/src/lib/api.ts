// Client for the Go API (ARCHITECTURE §4).
import { LinkError, type Ref } from '#lib/providers/parse.ts';
import type { Health } from '#lib/db/library.ts';

export interface Meta extends Ref {
	author?: string;
	thumbnail?: string;
	durationSec: number | null;
	health: Health;
	checkedAt: string;
}

export class ApiError extends Error {
	constructor(public status: number) {
		super(`api error ${status}`);
		this.name = 'ApiError';
	}
}

export const API_BASE: string = import.meta.env.VITE_API_BASE ?? '/api';

let lastWarm = 0;
/**
 * The free-tier API sleeps and takes ~50 s to wake. Opening the paste screen is the first
 * sign of a link coming: knock once now, so it is up by the time the link is pasted (R4.1).
 * Fire and forget: no-cors means no preflight and no reading of the answer, and it fails silently.
 */
export function warmUp(opts: { fetch?: typeof fetch; base?: string; now?: number } = {}): void {
	const now = opts.now ?? Date.now();
	if (now - lastWarm < 60_000) return;
	lastWarm = now;
	(opts.fetch ?? fetch)(`${opts.base ?? API_BASE}/healthz`, { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
}

export async function resolveLink(
	url: string,
	opts: { fetch?: typeof fetch; base?: string; signal?: AbortSignal } = {}
): Promise<Meta> {
	const f = opts.fetch ?? fetch;
	const res = await f(`${opts.base ?? API_BASE}/v1/resolve`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ url }),
		signal: opts.signal
	});
	if (res.status === 422) {
		const body = (await res.json().catch(() => ({}))) as { error?: string };
		throw new LinkError(body.error === 'unsupported_url' ? 'unsupported_url' : 'invalid_url');
	}
	if (!res.ok) throw new ApiError(res.status);
	return (await res.json()) as Meta;
}

export async function checkHealth(
	items: { id: string; url: string }[],
	opts: { fetch?: typeof fetch; base?: string; signal?: AbortSignal; fresh?: boolean } = {}
): Promise<{ id: string; health: Health; checkedAt: string }[]> {
	const f = opts.fetch ?? fetch;
	const res = await f(`${opts.base ?? API_BASE}/v1/health`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ items, fresh: opts.fresh === true }),
		signal: opts.signal
	});
	if (!res.ok) throw new ApiError(res.status);
	const body = (await res.json()) as { results?: { id: string; health: Health; checkedAt: string }[] };
	return body.results ?? [];
}

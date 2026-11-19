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

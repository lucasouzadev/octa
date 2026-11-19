import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LinkError, MAX_URL_LENGTH, parseLink } from './parse';

type Vector = {
	name: string;
	url: string;
	source?: string;
	kind?: string;
	id?: string;
	canonicalUrl?: string;
	embedSrc?: string;
	aspect?: string;
	title?: string;
	error?: 'invalid_url' | 'unsupported_url';
};

const vectors: Vector[] = JSON.parse(
	readFileSync(fileURLToPath(new URL('../../../../testdata/urls.json', import.meta.url)), 'utf8')
).cases;

describe('parseLink — shared vectors (same file as the Go API)', () => {
	it('has vectors', () => {
		expect(vectors.length).toBeGreaterThan(10);
	});

	for (const v of vectors) {
		it(v.name, () => {
			if (v.error) {
				expect(() => parseLink(v.url)).toThrow(LinkError);
				try {
					parseLink(v.url);
				} catch (e) {
					expect((e as LinkError).code).toBe(v.error);
				}
				return;
			}
			const ref = parseLink(v.url);
			expect({
				source: ref.source,
				kind: ref.kind,
				id: ref.id,
				canonicalUrl: ref.canonicalUrl,
				embedSrc: ref.embed.src,
				aspect: ref.embed.aspect,
				title: ref.title ?? ''
			}).toEqual({
				source: v.source,
				kind: v.kind,
				id: v.id,
				canonicalUrl: v.canonicalUrl,
				embedSrc: v.embedSrc,
				aspect: v.aspect,
				title: v.title ?? ''
			});
		});
	}

	it('rejects URLs longer than the cap', () => {
		const long = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&x=' + 'a'.repeat(MAX_URL_LENGTH);
		expect(() => parseLink(long)).toThrow(LinkError);
	});
});

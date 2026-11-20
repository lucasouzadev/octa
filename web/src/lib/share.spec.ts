import { describe, expect, it } from 'vitest';
import { sharedLink } from '#lib/share.ts';

const q = (s: string) => new URLSearchParams(s);

describe('sharedLink', () => {
	it('uses the url parameter first', () => {
		expect(sharedLink(q('url=https://youtu.be/dQw4w9WgXcQ&text=ignored'))).toBe('https://youtu.be/dQw4w9WgXcQ');
	});
	it('finds the link inside the shared text (Android puts it there)', () => {
		expect(sharedLink(q('text=' + encodeURIComponent('Olha isso https://youtu.be/dQw4w9WgXcQ muito bom')))).toBe('https://youtu.be/dQw4w9WgXcQ');
	});
	it('falls back to the title', () => {
		expect(sharedLink(q('title=' + encodeURIComponent('https://vm.tiktok.com/ZMabc/')))).toBe('https://vm.tiktok.com/ZMabc/');
	});
	it('drops trailing punctuation from a link inside a sentence', () => {
		expect(sharedLink(q('text=' + encodeURIComponent('veja https://youtu.be/dQw4w9WgXcQ.')))).toBe('https://youtu.be/dQw4w9WgXcQ');
	});
	it('returns nothing when there is no http(s) link, and never a javascript: one', () => {
		expect(sharedLink(q('text=hello'))).toBe('');
		expect(sharedLink(q('url=javascript:alert(1)'))).toBe('');
		expect(sharedLink(q(''))).toBe('');
	});
	it('caps what it reads', () => {
		expect(sharedLink(q('text=' + 'a'.repeat(100_000)))).toBe('');
	});
});

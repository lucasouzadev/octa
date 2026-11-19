import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

// QA round 1, item 3: every bottom sheet is the one Sheet component (handle, open and
// close motion, drag gesture). A second hand-made <dialog> would skip all of that.
const root = fileURLToPath(new URL('..', import.meta.url));

function* files(dir: string): Generator<string> {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) yield* files(path);
		else if (path.endsWith('.svelte')) yield path;
	}
}

describe('one sheet', () => {
	it('only Sheet.svelte opens a <dialog> or calls showModal', () => {
		const offenders = [...files(root)]
			.filter((f) => !f.endsWith(join('lib', 'ui', 'Sheet.svelte')))
			.filter((f) => /<dialog[\s>]|showModal\(/.test(readFileSync(f, 'utf8')))
			.map((f) => relative(root, f));
		expect(offenders).toEqual([]);
	});

	it('Sheet.svelte exists and has a handle', () => {
		const src = readFileSync(join(root, 'lib', 'ui', 'Sheet.svelte'), 'utf8');
		expect(src).toContain('class="handle"');
	});
});

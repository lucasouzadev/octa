import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

type Tree = { [k: string]: Tree | { $value: string | number } };

function flatten(tree: Tree, prefix: string[] = []): [string, string][] {
	return Object.entries(tree).flatMap(([k, v]) => {
		if (k.startsWith('$')) return [];
		if (v && typeof v === 'object' && '$value' in v) return [[[...prefix, k].join('-'), String(v.$value)]];
		return flatten(v as Tree, [...prefix, k]);
	});
}

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

describe('tokens.css mirrors docs/design/tokens.json', () => {
	const css = read('./tokens.css');
	const tokens = flatten(JSON.parse(read('../../../docs/design/tokens.json')));
	const cssTokens = tokens.filter(([name]) => !name.startsWith('three') && !name.startsWith('font'));

	it('has tokens to compare', () => {
		expect(cssTokens.length).toBeGreaterThan(30);
	});

	for (const [name, value] of cssTokens) {
		it(name, () => {
			expect(css).toContain(`--${kebab(name)}: ${value};`);
		});
	}
});

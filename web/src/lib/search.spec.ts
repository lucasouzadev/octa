import { describe, expect, it } from 'vitest';
import { normalize, searchVideos } from './search.ts';

type V = { id: string; title: string; author?: string };
const v = (id: string, title: string, author?: string): V => ({ id, title, author });
const ids = (list: V[]) => list.map((x) => x.id);

describe('normalize', () => {
	it('lowercases and strips accents', () => {
		expect(normalize('  AÇÃO Rápida  ')).toBe('acao rapida');
	});

	it('collapses inner whitespace', () => {
		expect(normalize('a \t  b\n c')).toBe('a b c');
	});

	it('keeps non-latin letters intact', () => {
		expect(normalize('日本語')).toBe('日本語');
	});
});

describe('searchVideos', () => {
	const library = [
		v('1', 'Receita de pão caseiro', 'Cozinha da Ana'),
		v('2', 'Pão de queijo mineiro', 'Chef Zé'),
		v('3', 'Treino de pernas', 'Academia Pão'),
		v('4', 'Viagem a São Paulo'),
		v('5', 'Música ao vivo', 'Banda Sol')
	];

	it('returns everything in the original order for an empty or blank query', () => {
		expect(ids(searchVideos(library, ''))).toEqual(['1', '2', '3', '4', '5']);
		expect(ids(searchVideos(library, '   '))).toEqual(['1', '2', '3', '4', '5']);
	});

	it('ignores case and accents on both sides', () => {
		expect(ids(searchVideos(library, 'PAO'))).toContain('1');
		expect(ids(searchVideos(library, 'musica'))).toEqual(['5']);
		expect(ids(searchVideos(library, 'são paulo'))).toEqual(['4']);
		expect(ids(searchVideos(library, 'sao paulo'))).toEqual(['4']);
	});

	it('matches the author as well as the title', () => {
		expect(ids(searchVideos(library, 'banda'))).toEqual(['5']);
		expect(ids(searchVideos(library, 'chef'))).toEqual(['2']);
	});

	it('requires every word, in any order', () => {
		expect(ids(searchVideos(library, 'caseiro pao'))).toEqual(['1']);
		expect(ids(searchVideos(library, 'pao ana'))).toEqual(['1']);
		expect(ids(searchVideos(library, 'pao banda'))).toEqual([]);
	});

	it('returns nothing when nothing matches', () => {
		expect(searchVideos(library, 'xyz')).toEqual([]);
	});

	it('ranks a title match above an author-only match', () => {
		// "pao": 1 and 2 have it in the title; 3 only in the author.
		const result = ids(searchVideos(library, 'pao'));
		expect(result.indexOf('3')).toBeGreaterThan(result.indexOf('1'));
		expect(result.indexOf('3')).toBeGreaterThan(result.indexOf('2'));
	});

	it('ranks a title that starts with the word above one that merely contains it', () => {
		const list = [v('a', 'Receita de pão'), v('b', 'Pão quentinho'), v('c', 'Compão')];
		expect(ids(searchVideos(list, 'pao'))).toEqual(['b', 'a', 'c']);
	});

	it('keeps the original (newest first) order between equal matches', () => {
		const list = [v('a', 'Gato 1'), v('b', 'Gato 2'), v('c', 'Gato 3')];
		expect(ids(searchVideos(list, 'gato'))).toEqual(['a', 'b', 'c']);
	});

	it('does not mutate the input', () => {
		const copy = library.map((x) => ({ ...x }));
		searchVideos(library, 'pao');
		expect(library).toEqual(copy);
	});

	it('treats regex characters literally', () => {
		const list = [v('a', 'C++ (curso)'), v('b', 'Cabo')];
		expect(ids(searchVideos(list, 'c++'))).toEqual(['a']);
		expect(ids(searchVideos(list, '.*'))).toEqual([]);
	});

	it('copes with videos without author or with an empty title', () => {
		const list = [v('a', ''), v('b', 'Algo')];
		expect(ids(searchVideos(list, 'algo'))).toEqual(['b']);
	});
});

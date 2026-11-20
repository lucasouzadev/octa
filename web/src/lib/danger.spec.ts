import { describe, expect, it } from 'vitest';
import { splitMark } from './danger.ts';

// QA round 3, item 5: the collection's name in the delete headline is highlighted like
// with a marker pen. The headline stays one string for screen readers.
describe('splitMark', () => {
	it('cuts the headline around the marked name', () => {
		expect(splitMark('Excluir “Aulas”?', 'Aulas')).toEqual(['Excluir “', 'Aulas', '”?']);
	});

	it('marks only the first occurrence', () => {
		expect(splitMark('Aulas e Aulas', 'Aulas')).toEqual(['', 'Aulas', ' e Aulas']);
	});

	it('returns the whole headline when there is nothing to mark', () => {
		expect(splitMark('Excluir?', undefined)).toEqual(['Excluir?', '', '']);
		expect(splitMark('Excluir?', '')).toEqual(['Excluir?', '', '']);
		expect(splitMark('Excluir?', 'Outra')).toEqual(['Excluir?', '', '']);
	});

	it('is case sensitive and does not read the name as a pattern', () => {
		expect(splitMark('Excluir “a.b”?', 'a.b')).toEqual(['Excluir “', 'a.b', '”?']);
		expect(splitMark('Excluir “axb”?', 'a.b')).toEqual(['Excluir “axb”?', '', '']);
	});
});

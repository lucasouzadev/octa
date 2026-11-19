/** Fold case, accents and runs of whitespace so "Ação  Rápida" matches "acao rapida". */
export function normalize(text: string): string {
	return text
		.normalize('NFD')
		.replace(/\p{M}+/gu, '')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}

interface Searchable {
	title: string;
	author?: string;
}

// Lower is better. A word typed by the user is worth most when it opens the
// title, then when it opens any word of the title, then anywhere in the title,
// and least when only the author has it.
const AT_TITLE_START = 0;
const AT_WORD_START = 1;
const IN_TITLE = 2;
const IN_AUTHOR = 3;

function rankWord(title: string, author: string, word: string): number | null {
	const at = title.indexOf(word);
	if (at === 0) return AT_TITLE_START;
	if (at > 0) {
		// Prefer a hit that starts a word over one in the middle of a word.
		let from = at;
		while (from !== -1) {
			if (title[from - 1] === ' ' || from === 0) return AT_WORD_START;
			from = title.indexOf(word, from + 1);
		}
		return IN_TITLE;
	}
	return author.includes(word) ? IN_AUTHOR : null;
}

/**
 * Client-side search over title and author. Every typed word must match
 * (any order). Results keep the caller's order between equal matches, so a
 * newest-first library stays newest-first. A blank query returns everything.
 */
export function searchVideos<T extends Searchable>(videos: readonly T[], query: string): T[] {
	const words = normalize(query).split(' ').filter(Boolean);
	if (words.length === 0) return [...videos];

	const scored: { video: T; score: number; index: number }[] = [];
	videos.forEach((video, index) => {
		const title = normalize(video.title);
		const author = normalize(video.author ?? '');
		let score = 0;
		for (const word of words) {
			const s = rankWord(title, author, word);
			if (s === null) return;
			score += s;
		}
		scored.push({ video, score, index });
	});

	scored.sort((a, b) => a.score - b.score || a.index - b.index);
	return scored.map((s) => s.video);
}

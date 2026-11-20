// The delete screen's headline keeps one string (screen readers read it whole); the name
// of what is being deleted is cut out only so it can be painted with a marker pen.
export function splitMark(title: string, mark?: string): [before: string, marked: string, after: string] {
	const at = mark ? title.indexOf(mark) : -1;
	if (!mark || at < 0) return [title, '', ''];
	return [title.slice(0, at), mark, title.slice(at + mark.length)];
}

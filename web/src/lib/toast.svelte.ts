// One short notice for the whole app ("Vídeo apagado"). It lives outside any page, so it
// survives the navigation that follows an action (a delete sends the person elsewhere).
export const TOAST_MS = 3000;

let timer: ReturnType<typeof setTimeout> | undefined;
const state = $state({ text: '' });

export const toast = {
	get text() {
		return state.text;
	},
	show(text: string) {
		clearTimeout(timer);
		state.text = text;
		timer = setTimeout(() => (state.text = ''), TOAST_MS);
	},
	clear() {
		clearTimeout(timer);
		state.text = '';
	}
};

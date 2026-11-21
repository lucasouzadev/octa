// One short notice for the whole app ("Vídeo apagado"). It lives outside any page, so it
// survives the navigation that follows an action (a delete sends the person elsewhere).
export const TOAST_MS = 3000;
/** A notice with a button ("Desfazer") stays longer: there is something to decide. */
export const TOAST_ACTION_MS = 6000;

export interface ToastAction {
	label: string;
	run: () => void | Promise<void>;
}

let timer: ReturnType<typeof setTimeout> | undefined;
const state = $state<{ text: string; action: ToastAction | undefined }>({ text: '', action: undefined });

export const toast = {
	get text() {
		return state.text;
	},
	get action() {
		return state.action;
	},
	show(text: string, action?: ToastAction) {
		clearTimeout(timer);
		state.text = text;
		state.action = action;
		timer = setTimeout(() => toast.clear(), action ? TOAST_ACTION_MS : TOAST_MS);
	},
	/** The button was tapped: the notice goes away and the action runs, once. */
	act() {
		const action = state.action;
		if (!action) return;
		toast.clear();
		void action.run();
	},
	clear() {
		clearTimeout(timer);
		state.text = '';
		state.action = undefined;
	}
};

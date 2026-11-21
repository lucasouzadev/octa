import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from './toast.svelte.ts';

describe('toast', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		toast.clear();
		vi.useRealTimers();
	});

	it('shows the text and hides it after the delay', () => {
		toast.show('Vídeo apagado');
		expect(toast.text).toBe('Vídeo apagado');
		vi.advanceTimersByTime(2999);
		expect(toast.text).toBe('Vídeo apagado');
		vi.advanceTimersByTime(2);
		expect(toast.text).toBe('');
	});

	it('a newer notice replaces the older one and restarts the clock', () => {
		toast.show('Primeiro');
		vi.advanceTimersByTime(2000);
		toast.show('Segundo');
		vi.advanceTimersByTime(2000);
		expect(toast.text).toBe('Segundo');
		vi.advanceTimersByTime(1100);
		expect(toast.text).toBe('');
	});

	it('clear hides it at once', () => {
		toast.show('Algo');
		toast.clear();
		expect(toast.text).toBe('');
	});

	it('an action keeps the notice for 6 s and runs once when tapped', () => {
		let ran = 0;
		toast.show('Vídeo apagado', { label: 'Desfazer', run: () => void ran++ });
		expect(toast.action?.label).toBe('Desfazer');
		vi.advanceTimersByTime(5500);
		expect(toast.text).toBe('Vídeo apagado');
		toast.act();
		toast.act();
		expect(ran).toBe(1);
		expect(toast.text).toBe('');
		expect(toast.action).toBeUndefined();
	});

	it('a notice without action has none left from the one before', () => {
		toast.show('Vídeo apagado', { label: 'Desfazer', run: () => {} });
		toast.show('Link copiado');
		expect(toast.action).toBeUndefined();
	});

	it('the action is gone when the time is up', () => {
		toast.show('Vídeo apagado', { label: 'Desfazer', run: () => {} });
		vi.advanceTimersByTime(6100);
		expect(toast.text).toBe('');
		expect(toast.action).toBeUndefined();
	});
});

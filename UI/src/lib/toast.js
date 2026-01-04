// Toast notification system - simple, non-invasive notifications
import { writable } from 'svelte/store';

export const toasts = writable([]);

let idCounter = 0;

export function showToast(message, type = 'info', duration = 3000) {
	const id = ++idCounter;
	const toast = { id, message, type, duration };
	
	toasts.update(all => [...all, toast]);
	
	if (duration > 0) {
		setTimeout(() => {
			removeToast(id);
		}, duration);
	}
	
	return id;
}

export function removeToast(id) {
	toasts.update(all => all.filter(t => t.id !== id));
}

// Convenience methods
export const toast = {
	success: (message, duration) => showToast(message, 'success', duration),
	error: (message, duration) => showToast(message, 'error', duration),
	info: (message, duration) => showToast(message, 'info', duration),
	warning: (message, duration) => showToast(message, 'warning', duration)
};

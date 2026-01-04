import { writable } from 'svelte/store';

// Store for confirmation dialog
const confirmStore = writable({
	isOpen: false,
	title: '',
	message: '',
	confirmText: 'Confirm',
	cancelText: 'Cancel',
	type: 'danger', // 'danger', 'warning', 'info'
	onConfirm: null,
	onCancel: null
});

let resolveCallback = null;

export const confirm = confirmStore;

/**
 * Show a confirmation dialog and return a promise
 * @param {Object} options - Dialog options
 * @param {string} options.title - Dialog title
 * @param {string} options.message - Dialog message
 * @param {string} [options.confirmText] - Confirm button text
 * @param {string} [options.cancelText] - Cancel button text
 * @param {string} [options.type] - Dialog type: 'danger', 'warning', 'info'
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
 */
export function showConfirm({
	title,
	message,
	confirmText = 'Confirm',
	cancelText = 'Cancel',
	type = 'danger'
}) {
	return new Promise((resolve) => {
		resolveCallback = resolve;
		
		confirmStore.set({
			isOpen: true,
			title,
			message,
			confirmText,
			cancelText,
			type,
			onConfirm: () => {
				confirmStore.update(state => ({ ...state, isOpen: false }));
				if (resolveCallback) {
					resolveCallback(true);
					resolveCallback = null;
				}
			},
			onCancel: () => {
				confirmStore.update(state => ({ ...state, isOpen: false }));
				if (resolveCallback) {
					resolveCallback(false);
					resolveCallback = null;
				}
			}
		});
	});
}

// Convenience methods
export const confirmDialog = {
	danger: (title, message) => showConfirm({ title, message, type: 'danger', confirmText: 'Delete' }),
	warning: (title, message) => showConfirm({ title, message, type: 'warning', confirmText: 'Yes' }),
	info: (title, message) => showConfirm({ title, message, type: 'info', confirmText: 'OK' })
};

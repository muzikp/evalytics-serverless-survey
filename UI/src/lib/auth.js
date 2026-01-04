// Auth store and utilities
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'evalytics_auth';

// Load initial auth state from localStorage
function loadAuth() {
	if (!browser) return null;
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		return stored ? JSON.parse(stored) : null;
	} catch {
		return null;
	}
}

// Create auth store
function createAuthStore() {
	const { subscribe, set, update } = writable(loadAuth());

	return {
		subscribe,
		login: (token, user) => {
			const auth = { token, user };
			if (browser) {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
			}
			set(auth);
		},
		logout: () => {
			if (browser) {
				localStorage.removeItem(STORAGE_KEY);
			}
			set(null);
		},
		refresh: () => {
			set(loadAuth());
		}
	};
}

export const auth = createAuthStore();

// Parse JWT to get user info (without verification - just for display)
export function parseJwt(token) {
	try {
		const base64Url = token.split('.')[1];
		const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
		const jsonPayload = decodeURIComponent(
			atob(base64)
				.split('')
				.map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
				.join('')
		);
		return JSON.parse(jsonPayload);
	} catch {
		return null;
	}
}

/**
 * Client-side API helper with JWT authentication
 *
 * - For local dev with Vite proxy, use /api prefix
 * - In prod, set VITE_API_BASE_URL to your API Gateway domain
 */

import { get } from 'svelte/store';
import { auth } from './auth.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Get authorization header
function getAuthHeader() {
	const authData = get(auth);
	return authData?.token ? { Authorization: `Bearer ${authData.token}` } : {};
}

// Generic API request
async function apiRequest(method, path, body = null, options = {}) {
	const url = `${API_BASE_URL}${path}`;
	const authData = get(auth);
	
	const headers = {
		'Content-Type': 'application/json',
		...getAuthHeader(),
		...options.headers
	};

	console.log(`[API] ${method} ${url}`, { hasAuth: !!authData?.token });

	const config = {
		method,
		headers
	};

	if (body) {
		config.body = JSON.stringify(body);
	}

	const res = await fetch(url, config);
	
	console.log(`[API] ${method} ${url} -> ${res.status}`);
	
	// Handle 401 - auto logout
	if (res.status === 401) {
		auth.logout();
		throw new Error('Unauthorized - please login again');
	}

	if (!res.ok) {
		let errorMessage = `${res.status} ${res.statusText}`;
		try {
			const errorData = await res.json();
			if (errorData.message) {
				errorMessage = errorData.message;
			}
		} catch {
			// Ignore JSON parse errors
		}
		throw new Error(errorMessage);
	}

	// Handle 204 No Content
	if (res.status === 204) {
		return null;
	}

	return await res.json();
}

// Public API methods
export async function apiGetJson(path) {
	return apiRequest('GET', path);
}

export async function apiPost(path, body) {
	return apiRequest('POST', path, body);
}

export async function apiDelete(path) {
	return apiRequest('DELETE', path);
}

// Auth API
export async function login(email, password) {
	return apiPost('/auth', { email, password });
}

// Forms API
export async function getForms(filters = {}) {
	const params = new URLSearchParams();
	Object.entries(filters).forEach(([key, value]) => {
		if (value !== undefined && value !== null && value !== '') {
			params.append(key, value);
		}
	});
	const query = params.toString();
	return apiGetJson(`/forms${query ? '?' + query : ''}`);
}

export async function getForm(id) {
	return apiGetJson(`/forms/${id}`);
}

export async function createForm(data) {
	return apiPost('/forms', data);
}

export async function updateForm(id, data) {
	return apiRequest('PUT', `/forms/${id}`, data);
}

export async function deleteForm(id) {
	return apiDelete(`/forms/${id}`);
}

// Form Versions API
export async function getFormVersions(filters = {}) {
	const params = new URLSearchParams();
	Object.entries(filters).forEach(([key, value]) => {
		if (value !== undefined && value !== null && value !== '') {
			params.append(key, value);
		}
	});
	const query = params.toString();
	return apiGetJson(`/form-versions${query ? '?' + query : ''}`);
}

export async function getFormVersion(id) {
	return apiGetJson(`/form-versions/${id}`);
}

export async function createFormVersion(data) {
	return apiPost('/form-versions', data);
}

export async function updateFormVersion(id, data) {
	return apiRequest('PUT', `/form-versions/${id}`, data);
}

export async function deleteFormVersion(id) {
	return apiDelete(`/form-versions/${id}`);
}

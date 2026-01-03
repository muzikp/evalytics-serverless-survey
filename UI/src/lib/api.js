/**
 * Minimal client-side API helper.
 *
 * - For local dev, set VITE_API_BASE_URL=http://127.0.0.1:3000
 * - In prod, point it to your API Gateway/custom domain.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export async function apiGetJson(path) {
	const url = `${API_BASE_URL}${path}`;
	const res = await fetch(url, {
		headers: {
			'Content-Type': 'application/json'
		}
	});
	if (!res.ok) {
		throw new Error(`${res.status} ${res.statusText} (${url})`);
	}
	return await res.json();
}

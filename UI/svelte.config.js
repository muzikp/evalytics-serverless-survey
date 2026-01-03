import adapter from '@sveltejs/adapter-static';

const dev = process.env.NODE_ENV === 'development';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// Static export (GitHub Pages / static hosting)
		adapter: adapter({
			// Required for GitHub Pages so that deep links work.
			// GitHub Pages serves 404.html for unknown routes.
			fallback: '404.html'
		}),
		paths: {
			// For GitHub Pages repositories (https://<user>.github.io/<repo>/)
			base: dev ? '' : (process.env.BASE_PATH ?? '')
		}
	}
};

export default config;

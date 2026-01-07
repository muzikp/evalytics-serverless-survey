import adapter from '@sveltejs/adapter-static';

const dev = process.env.NODE_ENV === 'development';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// Static export (S3 + CloudFront hosting)
		adapter: adapter({
			// Use index.html as fallback for SPA routing
			// CloudFront will use this as default root object and for 404 errors
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: false,
			strict: false
		}),
		paths: {
			// For GitHub Pages repositories (https://<user>.github.io/<repo>/)
			base: dev ? '' : (process.env.BASE_PATH ?? '')
		}
	}
};

export default config;

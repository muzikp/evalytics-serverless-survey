<script>
	import { base } from '$app/paths';
</script>

<header class="header">
	<div class="brand">
		<a class="brandLink" href="{base}/">Evalytics Survey</a>
	</div>
	<nav class="nav">
		<a href="{base}/admin/">Admin</a>
		<a href="{base}/survey/demo/">Survey demo</a>
	</nav>
</header>

<main class="main">
	<slot />
</main>

<style>
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid #e5e5e5;
	}
	.brandLink {
		text-decoration: none;
		font-weight: 700;
		color: inherit;
	}
	.nav {
		display: flex;
		gap: 14px;
	}
	.nav a {
		text-decoration: none;
		color: inherit;
		opacity: 0.85;
	}
	.nav a:hover {
		opacity: 1;
		text-decoration: underline;
	}
	.main {
		max-width: 980px;
		margin: 0 auto;
		padding: 24px 20px;
	}
</style>

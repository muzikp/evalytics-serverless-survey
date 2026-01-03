<script>
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { apiGetJson } from '$lib/api.js';

	$: publicId = $page.params.publicId;

	let loading = true;
	let error = '';
	let survey = null;

	onMount(async () => {
		try {
			// TODO: 실제 public endpoint (např. /public/surveys/{publicId})
			survey = await apiGetJson(`/public/surveys/${publicId}`);
		} catch (e) {
			error = e?.message ?? String(e);
		} finally {
			loading = false;
		}
	});
</script>

<h1>Survey: {publicId}</h1>

{#if loading}
	<p>Načítám…</p>
{:else if error}
	<p class="err">
		Nepodařilo se načíst survey. (To je očekávané, dokud nebude hotový public endpoint.)
		<br />
		<small>{error}</small>
	</p>
{:else}
	<pre>{JSON.stringify(survey, null, 2)}</pre>
{/if}

<p>
	<a href="{base}/">Zpět</a>
</p>

<style>
	.err {
		padding: 12px 14px;
		border: 1px solid #e5b5b5;
		background: #fff5f5;
		border-radius: 10px;
	}
</style>

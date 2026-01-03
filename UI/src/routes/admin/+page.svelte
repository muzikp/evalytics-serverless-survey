<script>
	let token = '';

	function saveToken() {
		localStorage.setItem('evalytics_admin_jwt', token);
		alert('Uloženo do localStorage (evalytics_admin_jwt).');
	}
</script>

<h1>Admin (skeleton)</h1>

<p>
	Sem přijde admin UI pro správu organizací, survey, distribucí a náhled výsledků.
	Zatím jen jednoduché uložení JWT do localStorage.
</p>

<label>
	JWT (Bearer)
	<textarea bind:value={token} rows="6" placeholder="eyJ..." style="width:100%"></textarea>
</label>

<button on:click={saveToken}>Uložit token</button>
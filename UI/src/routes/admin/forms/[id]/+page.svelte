<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { auth } from '$lib/auth.js';
	import { getForm, createForm, updateForm } from '$lib/api.js';
	import JsonEditor from '$lib/components/JsonEditor.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	let editor;
	let form = null;
	let loading = true;
	let saving = false;
	let error = '';

	let form = {
		name: '',
		surveyjs_version: '1.9.116',
		languages: ['cs'],
		data: '{}'
	};

	$: templateId = $page.params.id;
	$: isNewForm = templateId === 'new';

	// Check auth
	$: if (!$auth) {
		goto('/login');
	}

	onMount(() => {
		if (!isNewForm) {
			loadForm();
		} else {
			loading = false;
			form.data = JSON.stringify(
				{
					title: 'New Survey',
					pages: [
						{
							name: 'page1',
							elements: [
								{
									type: 'text',
									name: 'question1',
									title: 'What is your name?'
								}
							]
						}
					]
				},
				null,
				2
			);
		}
	});

	async function loadForm() {
		loading = true;
		error = '';
		try {
			template = await getForm(templateId);
			form.name = template.name;
			form.surveyjs_version = template.surveyjs_version;
			form.languages = template.languages || [];
			form.data = JSON.stringify(template.data, null, 2);
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	async function handleSave() {
		error = '';
		saving = true;

		try {
			// Validate JSON
			const data = editor.getJson();

			const payload = {
				name: form.name.trim(),
				surveyjs_version: form.surveyjs_version.trim(),
				languages: form.languages,
				data
			};

			if (isNewForm) {
				const created = await createForm(payload);
				goto(`/admin/forms/${created.data.form_id}`);
			} else {
				await updateForm(templateId, payload);
				await loadForm();
				alert('Form updated successfully!');
			}
		} catch (err) {
			error = err.message;
		} finally {
			saving = false;
		}
	}

	function addLanguage() {
		const lang = prompt('Enter language code (e.g., en, cs, de):');
		if (lang && !form.languages.includes(lang.trim())) {
			form.languages = [...form.languages, lang.trim()];
		}
	}

	function removeLanguage(lang) {
		form.languages = form.languages.filter((l) => l !== lang);
	}

	function formatJson() {
		if (editor) {
			editor.format();
		}
	}
</script>

<svelte:head>
	<title>{isNewForm ? 'New Form' : form.name || 'Edit Form'} - Evalytics</title>
</svelte:head>

<div class="page-header">
	<div>
		<a href="/admin/forms" class="back-link">← Forms</a>
		<h1>{isNewForm ? 'Create New Form' : 'Edit Form'}</h1>
	</div>
	<div class="header-actions">
		{#if !isNewForm}
			<a href="/admin/form-versions?form_id={templateId}" class="btn-secondary">View Snapshots</a>
		{/if}
		<button on:click={handleSave} class="btn-primary" disabled={saving || loading}>
			{saving ? 'Saving...' : isNewForm ? 'Create' : 'Save Changes'}
		</button>
	</div>
</div>

{#if loading}
	<Spinner centered size="lg">Loading template...</Spinner>
{:else}
	{#if error}
		<div class="error-message">{error}</div>
	{/if}

	<div class="editor-layout">
		<div class="form-section">
			<h2>Form Details</h2>

			<div class="form-group">
				<label for="name">Form Name *</label>
				<input id="name" type="text" bind:value={form.name} required placeholder="My Survey Form" />
			</div>

			<div class="form-group">
				<label for="version">SurveyJS Version *</label>
				<input
					id="version"
					type="text"
					bind:value={form.surveyjs_version}
					required
					placeholder="1.9.116"
				/>
			</div>

			<div class="form-group">
				<label>Languages *</label>
				<div class="languages-list">
					{#each form.languages as lang}
						<span class="language-tag">
							{lang}
							<button type="button" on:click={() => removeLanguage(lang)} class="remove-lang">×</button>
						</span>
					{/each}
					<button type="button" on:click={addLanguage} class="btn-small">+ Add Language</button>
				</div>
			</div>

			{#if !isNewForm && template}
				<div class="info-section">
					<h3>Form Info</h3>
					<dl>
						<dt>ID:</dt>
						<dd><code>{template.form_id}</code></dd>
						<dt>Created:</dt>
						<dd>{new Date(template.created).toLocaleString()}</dd>
						<dt>Last Update:</dt>
						<dd>{new Date(template.last_update).toLocaleString()}</dd>
					</dl>
				</div>
			{/if}
		</div>

		<div class="json-section">
			<div class="section-header">
				<h2>Survey Definition (JSON)</h2>
				<button type="button" on:click={formatJson} class="btn-small">Format JSON</button>
			</div>

			<JsonEditor bind:this={editor} bind:value={form.data} height="600px" />

			<div class="json-help">
				<p><strong>SurveyJS JSON Schema:</strong></p>
				<ul>
					<li><code>title</code> - Survey title</li>
					<li><code>pages</code> - Array of pages, each with <code>elements</code> (questions)</li>
					<li>
						Question types: <code>text</code>, <code>checkbox</code>, <code>radiogroup</code>,
						<code>dropdown</code>, <code>comment</code>, <code>rating</code>, etc.
					</li>
					<li>
						Docs: <a href="https://surveyjs.io/form-library/documentation/design-survey/create-a-simple-survey" target="_blank">SurveyJS Documentation</a>
					</li>
				</ul>
			</div>
		</div>
	</div>
{/if}

<style>
	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 24px;
		gap: 16px;
	}

	.back-link {
		display: inline-block;
		color: #666;
		text-decoration: none;
		margin-bottom: 8px;
		font-size: 14px;
	}

	.back-link:hover {
		color: #333;
	}

	h1 {
		margin: 0;
		font-size: 28px;
	}

	.header-actions {
		display: flex;
		gap: 12px;
	}

	.loading {
		text-align: center;
		padding: 40px;
		color: #666;
	}

	.error-message {
		padding: 16px;
		margin-bottom: 24px;
		background-color: #fee;
		border: 1px solid #fcc;
		border-radius: 4px;
		color: #c33;
	}

	.editor-layout {
		display: grid;
		grid-template-columns: 350px 1fr;
		gap: 24px;
		align-items: start;
	}

	.form-section,
	.json-section {
		background: white;
		border: 1px solid #e5e5e5;
		border-radius: 8px;
		padding: 24px;
	}

	h2 {
		margin: 0 0 20px 0;
		font-size: 18px;
		font-weight: 600;
	}

	h3 {
		margin: 24px 0 12px 0;
		font-size: 16px;
		font-weight: 600;
	}

	.form-group {
		margin-bottom: 20px;
	}

	label {
		display: block;
		margin-bottom: 6px;
		font-weight: 500;
		font-size: 14px;
	}

	input {
		width: 100%;
		padding: 8px 12px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 14px;
		font-family: inherit;
		box-sizing: border-box;
	}

	input:focus {
		outline: none;
		border-color: #4a90e2;
		box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
	}

	.languages-list {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		align-items: center;
	}

	.language-tag {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		background-color: #e3f2fd;
		border: 1px solid #90caf9;
		border-radius: 4px;
		font-size: 14px;
	}

	.remove-lang {
		background: none;
		border: none;
		color: #666;
		cursor: pointer;
		font-size: 18px;
		line-height: 1;
		padding: 0;
		margin: 0;
	}

	.remove-lang:hover {
		color: #d32f2f;
	}

	.info-section {
		margin-top: 24px;
		padding-top: 24px;
		border-top: 1px solid #e5e5e5;
	}

	dl {
		margin: 0;
		display: grid;
		grid-template-columns: 100px 1fr;
		gap: 8px 12px;
		font-size: 14px;
	}

	dt {
		font-weight: 500;
		color: #666;
	}

	dd {
		margin: 0;
	}

	code {
		font-family: 'Consolas', 'Monaco', monospace;
		font-size: 13px;
		background-color: #f5f5f5;
		padding: 2px 6px;
		border-radius: 3px;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}

	.json-help {
		margin-top: 16px;
		padding: 16px;
		background-color: #f8f9fa;
		border-radius: 4px;
		font-size: 14px;
	}

	.json-help p {
		margin: 0 0 8px 0;
	}

	.json-help ul {
		margin: 0;
		padding-left: 20px;
	}

	.json-help li {
		margin-bottom: 4px;
	}

	.json-help a {
		color: #4a90e2;
	}

	.btn-primary {
		padding: 10px 20px;
		background-color: #4a90e2;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
	}

	.btn-primary:hover:not(:disabled) {
		background-color: #357abd;
	}

	.btn-primary:disabled {
		background-color: #ccc;
		cursor: not-allowed;
	}

	.btn-secondary {
		padding: 10px 20px;
		background-color: white;
		color: #333;
		text-decoration: none;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		display: inline-block;
	}

	.btn-secondary:hover {
		background-color: #f5f5f5;
	}

	.btn-small {
		padding: 6px 12px;
		font-size: 13px;
		background-color: white;
		color: #666;
		border: 1px solid #ddd;
		border-radius: 4px;
		cursor: pointer;
	}

	.btn-small:hover {
		background-color: #f5f5f5;
	}

	@media (max-width: 1024px) {
		.editor-layout {
			grid-template-columns: 1fr;
		}
	}
</style>

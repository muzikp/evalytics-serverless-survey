<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { auth } from "$lib/auth.js";
  import { getForms, deleteForm } from "$lib/api.js";
  import Spinner from "$lib/components/Spinner.svelte";
  import { translations_store } from "$lib/i18n/index.js";
  import { timeAgo, formatDateTime } from "$lib/utils/time.js";
  import { toast } from "$lib/toast.js";
  import { showConfirm } from "$lib/confirm.js";

  $: t = $translations_store;

  let forms = [];
  let loading = true;
  let error = "";
  let filters = {
    q: "",
    surveyjs_version: "",
    languages: "",
  };

  // Available options for filters (populated from API data)
  let availableLanguages = [];
  let availableVersions = [];
  let selectedLanguages = [];

  // Check auth
  $: if (!$auth) {
    goto("/login");
  }

  // Update filters.languages when selectedLanguages changes
  $: filters.languages = selectedLanguages.join(",");

  onMount(() => {
    loadForms();
  });

  async function loadForms() {
    loading = true;
    error = "";
    try {
      const response = await getForms(filters);
      forms = response.forms || [];

      // Extract unique languages and versions from all forms
      if (
        !filters.q &&
        !filters.surveyjs_version &&
        selectedLanguages.length === 0
      ) {
        // Only update available options when no filters are active (to show all possible values)
        const languagesSet = new Set();
        const versionsSet = new Set();

        forms.forEach((form) => {
          if (form.languages) {
            form.languages.forEach((lang) => languagesSet.add(lang));
          }
          if (form.surveyjs_version) {
            versionsSet.add(form.surveyjs_version);
          }
        });

        availableLanguages = Array.from(languagesSet).sort();
        availableVersions = Array.from(versionsSet).sort().reverse(); // newest first
      }
    } catch (err) {
      error = err.message;
      console.error("Failed to load forms:", err);
    } finally {
      loading = false;
    }
  }

  async function handleDelete(id, name) {
    const confirmed = await showConfirm({
      title: "Delete Form",
      message: `Are you sure you want to delete "${name}"?\n\nThis will also delete all associated versions and may affect active campaigns.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      type: "danger",
    });

    if (!confirmed) {
      return;
    }

    try {
      await deleteForm(id);
      toast.success(`Form "${name}" deleted successfully`);
      await loadForms();
    } catch (err) {
      toast.error("Delete failed: " + err.message);
    }
  }

  function handleFilterChange() {
    loadForms();
  }

  function toggleLanguage(lang) {
    if (selectedLanguages.includes(lang)) {
      selectedLanguages = selectedLanguages.filter((l) => l !== lang);
    } else {
      selectedLanguages = [...selectedLanguages, lang];
    }
    loadForms();
  }

  function clearFilters() {
    filters = { q: "", surveyjs_version: "", languages: "" };
    selectedLanguages = [];
    loadForms();
  }
</script>

<svelte:head>
  <title>{t("forms.title")} - {t("app.name")}</title>
</svelte:head>

<div class="page-header">
  <h1>{t("forms.title")}</h1>
  <a href="/admin/forms/new" class="btn-primary">{t("forms.new")}</a>
</div>

<div class="filters">
  <input
    type="text"
    placeholder={t("common.search")}
    bind:value={filters.q}
    on:input={handleFilterChange}
  />

  <select bind:value={filters.surveyjs_version} on:change={handleFilterChange}>
    <option value="">{t("forms.version")} - All</option>
    {#each availableVersions as version}
      <option value={version}>{version}</option>
    {/each}
  </select>

  <div class="language-filter">
    <div class="filter-label">{t("forms.languages")}:</div>
    <div class="language-checkboxes">
      {#if availableLanguages.length === 0}
        <span class="text-muted">{t("common.loading")}</span>
      {:else}
        {#each availableLanguages as lang}
          <label class="checkbox-label">
            <input
              type="checkbox"
              checked={selectedLanguages.includes(lang)}
              on:change={() => toggleLanguage(lang)}
            />
            <span>{lang.toUpperCase()}</span>
          </label>
        {/each}
      {/if}
    </div>
  </div>

  <button on:click={clearFilters} class="btn-secondary"
    >{t("common.filter")}</button
  >
</div>

{#if loading}
  <Spinner centered size="lg">{t("common.loading")}</Spinner>
{:else if error}
  <div class="alert alert-error">{error}</div>
{:else if forms.length === 0}
  <div class="empty-state">
    <svg
      class="empty-icon"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
    <h3>No forms yet</h3>
    <p>Create your first survey form to get started</p>
    <a href="/admin/forms/new" class="btn-primary">Create Form</a>
  </div>
{:else}
  <div class="card">
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>SurveyJS Version</th>
          <th>Languages</th>
          <th>Versions</th>
          <th>Created</th>
          <th>Last Update</th>
          <th class="actions-header">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each forms as form}
          <tr class="fade-in">
            <td>
              <a href="/admin/forms/{form.form_id}" class="form-link">
                {form.name}
              </a>
            </td>
            <td
              ><span class="badge badge-secondary">{form.surveyjs_version}</span
              ></td
            >
            <td>
              <div class="language-tags">
                {#each form.languages || [] as lang}
                  <span class="badge badge-light">{lang}</span>
                {/each}
              </div>
            </td>
            <td><span class="count-badge">{form.version_count || 0}</span></td>
            <td class="text-muted" title={formatDateTime(form.created, "cs")}
              >{timeAgo(form.created, "cs")}</td
            >
            <td
              class="text-muted"
              title={formatDateTime(form.last_update, "cs")}
              >{timeAgo(form.last_update, "cs")}</td
            >
            <td class="actions">
              <a
                href="/admin/forms/{form.form_id}"
                class="btn-icon"
                title="Edit"
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </a>
              <button
                on:click={() => handleDelete(form.form_id, form.name)}
                class="btn-icon btn-danger"
                title="Delete"
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  h1 {
    margin: 0;
    font-size: 2rem;
    font-weight: 700;
    color: var(--color-text);
  }

  .filters {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .filters input,
  .filters select {
    flex: 1;
    min-width: 200px;
    padding: 0.625rem 1rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    transition: all 0.2s;
    background: white;
  }

  .filters input:focus,
  .filters select:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-light);
  }

  .language-filter {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: white;
    flex-wrap: wrap;
  }

  .filter-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    white-space: nowrap;
  }

  .language-checkboxes {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    cursor: pointer;
    font-size: 0.875rem;
    user-select: none;
  }

  .checkbox-label input[type="checkbox"] {
    width: auto;
    min-width: auto;
    cursor: pointer;
  }

  .checkbox-label span {
    color: var(--color-text);
    font-weight: 500;
  }

  .checkbox-label:hover span {
    color: var(--color-primary);
  }

  .alert {
    padding: 1rem 1.25rem;
    border-radius: var(--radius-md);
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .alert-error {
    background-color: #fef2f2;
    border: 1px solid #fecaca;
    color: var(--color-danger);
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    background: white;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
  }

  .empty-icon {
    width: 4rem;
    height: 4rem;
    margin: 0 auto 1.5rem;
    color: var(--color-text-tertiary);
  }

  .empty-state h3 {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: var(--color-text);
  }

  .empty-state p {
    color: var(--color-text-secondary);
    margin-bottom: 1.5rem;
  }

  .card {
    background: white;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  thead {
    background: var(--color-bg-tertiary);
    border-bottom: 2px solid var(--color-border);
  }

  th {
    padding: 1rem 1.25rem;
    text-align: left;
    font-weight: 600;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-secondary);
  }

  .actions-header {
    text-align: right;
  }

  td {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-border-light);
    font-size: 0.875rem;
  }

  tbody tr {
    transition: background-color 0.15s;
  }

  tbody tr:hover {
    background-color: var(--color-bg-secondary);
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  .form-link {
    color: var(--color-primary);
    text-decoration: none;
    font-weight: 500;
    transition: color 0.2s;
  }

  .form-link:hover {
    color: var(--color-primary-hover);
    text-decoration: underline;
  }

  .badge {
    display: inline-block;
    padding: 0.25rem 0.625rem;
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    font-weight: 500;
  }

  .badge-secondary {
    background: var(--color-primary-light);
    color: var(--color-primary);
  }

  .badge-light {
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
  }

  .language-tags {
    display: flex;
    gap: 0.375rem;
    flex-wrap: wrap;
  }

  .count-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.75rem;
    height: 1.75rem;
    padding: 0 0.5rem;
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-sm);
    font-weight: 600;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .btn-primary {
    padding: 0.625rem 1.25rem;
    background: var(--color-primary);
    color: white;
    text-decoration: none;
    border: none;
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;
    box-shadow: var(--shadow-sm);
  }

  .btn-primary:hover {
    background: var(--color-primary-hover);
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
  }

  .btn-secondary {
    padding: 0.5rem 1rem;
    background: white;
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary:hover {
    background: var(--color-bg-secondary);
    border-color: var(--color-text-tertiary);
  }

  .btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    background: transparent;
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
  }

  .btn-icon svg {
    width: 1.125rem;
    height: 1.125rem;
  }

  .btn-icon:hover {
    background: var(--color-primary-light);
    color: var(--color-primary);
    border-color: var(--color-primary);
  }

  .btn-icon.btn-danger:hover {
    background: #fef2f2;
    color: var(--color-danger);
    border-color: var(--color-danger);
  }
</style>

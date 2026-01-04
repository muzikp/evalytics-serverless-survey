<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { auth } from "$lib/auth.js";
  import { getFormVersions, deleteFormVersion, getForms } from "$lib/api.js";
  import Spinner from "$lib/components/Spinner.svelte";
  import { showConfirm } from "$lib/confirm.js";
  import { toast } from "$lib/toast.js";

  let versions = [];
  let loading = true;
  let error = "";
  let filters = {
    q: "",
    form_id: "",
    surveyjs_version: "",
    languages: "",
  };

  // Get form_id from URL query params
  $: {
    const urlFormId = $page.url.searchParams.get("form_id");
    if (urlFormId && filters.form_id !== urlFormId) {
      filters.form_id = urlFormId;
    }
  }

  // Check auth
  $: if (!$auth) {
    goto("/login");
  }

  onMount(() => {
    loadVersions();
  });

  async function loadVersions() {
    loading = true;
    error = "";
    try {
      const response = await getFormVersions(filters);
      versions = response.items || [];
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function handleDelete(id, name, version) {
    const confirmed = await showConfirm({
      title: "Delete Form Version",
      message: `Are you sure you want to delete "${name}" v${version}?\n\nThis may affect campaigns using this version.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      type: "danger",
    });

    if (!confirmed) {
      return;
    }

    try {
      await deleteFormVersion(id);
      toast.success(`Version ${version} deleted successfully`);
      await loadVersions();
    } catch (err) {
      toast.error("Delete failed: " + err.message);
    }
  }

  function handleFilterChange() {
    // Update URL if form_id changes
    if (filters.form_id) {
      goto(`/admin/form-versions?form_id=${filters.form_id}`, {
        replaceState: true,
      });
    }
    loadVersions();
  }

  function clearFilters() {
    filters = { q: "", form_id: "", surveyjs_version: "", languages: "" };
    goto("/admin/form-versions", { replaceState: true });
    loadVersions();
  }
</script>

<svelte:head>
  <title>Versions - Evalytics</title>
</svelte:head>

<div class="page-header">
  <div>
    {#if filters.form_id}
      <a href="/admin/forms/{filters.form_id}" class="back-link"
        >← Back to Form</a
      >
    {/if}
    <h1>Survey Versions</h1>
  </div>
  <a href="/admin/form-versions/new" class="btn-primary">Create Version</a>
</div>

<div class="filters">
  <input
    type="text"
    placeholder="Search..."
    bind:value={filters.q}
    on:input={handleFilterChange}
  />
  <input
    type="text"
    placeholder="Form ID..."
    bind:value={filters.form_id}
    on:input={handleFilterChange}
  />
  <input
    type="text"
    placeholder="SurveyJS version..."
    bind:value={filters.surveyjs_version}
    on:input={handleFilterChange}
  />
  <input
    type="text"
    placeholder="Languages (cs,en)..."
    bind:value={filters.languages}
    on:input={handleFilterChange}
  />
  <button on:click={clearFilters} class="btn-secondary">Clear</button>
</div>

{#if loading}
  <Spinner centered size="lg">Loading versions...</Spinner>
{:else if error}
  <div class="error-message">{error}</div>
{:else if versions.length === 0}
  <div class="empty-state">
    <p>No versions found.</p>
    <a href="/admin/form-versions/new" class="btn-primary"
      >Create your first version</a
    >
  </div>
{:else}
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th>Form</th>
          <th>Version</th>
          <th>SurveyJS</th>
          <th>Languages</th>
          <th>Created</th>
          <th>Last Update</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each versions as version}
          <tr>
            <td>
              <a href="/admin/forms/{version.form_id}" class="link">
                {version.form_name || version.form_id}
              </a>
            </td>
            <td>
              <span class="version-badge">v{version.version}</span>
            </td>
            <td>{version.surveyjs_version}</td>
            <td>{version.languages?.join(", ") || "-"}</td>
            <td>{new Date(version.created).toLocaleDateString()}</td>
            <td>{new Date(version.last_update).toLocaleDateString()}</td>
            <td class="actions">
              <a
                href="/admin/form-versions/{version.version_id}"
                class="btn-small">View</a
              >
              <button
                on:click={() =>
                  handleDelete(
                    version.version_id,
                    version.form_name,
                    version.version,
                  )}
                class="btn-small btn-danger"
              >
                Delete
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
    align-items: flex-start;
    margin-bottom: 24px;
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

  .filters {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }

  .filters input {
    flex: 1;
    min-width: 180px;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
  }

  .loading {
    text-align: center;
    padding: 40px;
    color: #666;
  }

  .error-message {
    padding: 16px;
    background-color: #fee;
    border: 1px solid #fcc;
    border-radius: 4px;
    color: #c33;
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: #666;
  }

  .empty-state p {
    margin-bottom: 16px;
  }

  .table-container {
    overflow-x: auto;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  thead {
    background-color: #f8f8f8;
  }

  th {
    padding: 12px 16px;
    text-align: left;
    font-weight: 600;
    border-bottom: 2px solid #e5e5e5;
  }

  td {
    padding: 12px 16px;
    border-bottom: 1px solid #f0f0f0;
  }

  tbody tr:hover {
    background-color: #fafafa;
  }

  .link {
    color: #4a90e2;
    text-decoration: none;
    font-weight: 500;
  }

  .link:hover {
    text-decoration: underline;
  }

  .version-badge {
    display: inline-block;
    padding: 4px 8px;
    background-color: #e3f2fd;
    border: 1px solid #90caf9;
    border-radius: 4px;
    font-weight: 600;
    font-size: 12px;
  }

  .actions {
    display: flex;
    gap: 8px;
  }

  .btn-primary {
    padding: 10px 20px;
    background-color: #4a90e2;
    color: white;
    text-decoration: none;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    display: inline-block;
  }

  .btn-primary:hover {
    background-color: #357abd;
  }

  .btn-secondary {
    padding: 8px 16px;
    background-color: white;
    color: #333;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
  }

  .btn-secondary:hover {
    background-color: #f5f5f5;
  }

  .btn-small {
    padding: 6px 12px;
    font-size: 13px;
    background-color: white;
    color: #4a90e2;
    text-decoration: none;
    border: 1px solid #4a90e2;
    border-radius: 4px;
    cursor: pointer;
    display: inline-block;
  }

  .btn-small:hover {
    background-color: #4a90e2;
    color: white;
  }

  .btn-small.btn-danger {
    color: #d32f2f;
    border-color: #d32f2f;
  }

  .btn-small.btn-danger:hover {
    background-color: #d32f2f;
    color: white;
  }
</style>

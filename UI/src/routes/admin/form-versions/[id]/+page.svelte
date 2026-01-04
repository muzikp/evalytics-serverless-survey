<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { auth } from "$lib/auth.js";
  import { getFormVersion } from "$lib/api.js";
  import JsonEditor from "$lib/components/JsonEditor.svelte";
  import Spinner from "$lib/components/Spinner.svelte";

  let version = null;
  let loading = true;
  let error = "";

  $: versionId = $page.params.id;

  // Check auth
  $: if (!$auth) {
    goto("/login");
  }

  onMount(() => {
    if (versionId && versionId !== "new") {
      loadVersion();
    } else {
      loading = false;
      error =
        "Manual version creation not implemented in UI yet. Use Form editor to create versions.";
    }
  });

  async function loadVersion() {
    loading = true;
    error = "";
    try {
      version = await getFormVersion(versionId);
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title
    >{version ? `${version.form_name} v${version.version}` : "Version"} -
    Evalytics</title
  >
</svelte:head>

<div class="page-header">
  <div>
    <a href="/admin/form-versions" class="back-link">← Versions</a>
    <h1>
      {version ? `${version.form_name} v${version.version}` : "Version"}
    </h1>
  </div>
  {#if version}
    <a href="/admin/forms/{version.form_id}" class="btn-secondary"
      >Edit Form</a
    >
  {/if}
</div>

{#if loading}
  <Spinner centered size="lg">Loading version...</Spinner>
{:else if error}
  <div class="error-message">{error}</div>
{:else if version}
  <div class="version-layout">
    <div class="info-panel">
      <h2>Version Details</h2>

      <div class="info-group">
        <label>Version ID</label>
        <code>{version.version_id}</code>
      </div>

      <div class="info-group">
        <label>Form</label>
        <a href="/admin/forms/{version.form_id}" class="link">
          {version.form_name}
        </a>
      </div>

      <div class="info-group">
        <label>Version</label>
        <span class="version-badge">v{version.version}</span>
      </div>

      <div class="info-group">
        <label>SurveyJS Version</label>
        <span>{version.surveyjs_version}</span>
      </div>

      <div class="info-group">
        <label>Languages</label>
        <div class="languages">
          {#each version.languages || [] as lang}
            <span class="language-tag">{lang}</span>
          {/each}
        </div>
      </div>

      <div class="info-group">
        <label>Created</label>
        <span>{new Date(version.created).toLocaleString()}</span>
      </div>

      <div class="info-group">
        <label>Last Update</label>
        <span>{new Date(version.last_update).toLocaleString()}</span>
      </div>

      <div class="warning-box">
        <strong>⚠️ Read-Only</strong>
        <p>
          Versions cannot be edited directly. Use the Form editor to create
          new versions.
        </p>
      </div>
    </div>

    <div class="json-panel">
      <h2>Survey Definition (Read-Only)</h2>
      <JsonEditor
        value={JSON.stringify(version.data, null, 2)}
        readonly={true}
        height="700px"
      />
    </div>
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

  h2 {
    margin: 0 0 20px 0;
    font-size: 18px;
    font-weight: 600;
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

  .version-layout {
    display: grid;
    grid-Form-columns: 350px 1fr;
    gap: 24px;
    align-items: start;
  }

  .info-panel,
  .json-panel {
    background: white;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    padding: 24px;
  }

  .info-group {
    margin-bottom: 20px;
  }

  .info-group label {
    display: block;
    margin-bottom: 6px;
    font-weight: 500;
    font-size: 14px;
    color: #666;
  }

  code {
    display: block;
    font-family: "Consolas", "Monaco", monospace;
    font-size: 13px;
    background-color: #f5f5f5;
    padding: 8px 12px;
    border-radius: 4px;
    word-break: break-all;
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
    padding: 6px 12px;
    background-color: #e3f2fd;
    border: 1px solid #90caf9;
    border-radius: 4px;
    font-weight: 600;
    font-size: 14px;
  }

  .languages {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .language-tag {
    display: inline-block;
    padding: 4px 10px;
    background-color: #e8f5e9;
    border: 1px solid #a5d6a7;
    border-radius: 4px;
    font-size: 13px;
  }

  .warning-box {
    margin-top: 24px;
    padding: 16px;
    background-color: #fff3cd;
    border: 1px solid #ffc107;
    border-radius: 4px;
  }

  .warning-box strong {
    display: block;
    margin-bottom: 8px;
    color: #856404;
  }

  .warning-box p {
    margin: 0;
    font-size: 14px;
    color: #856404;
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

  @media (max-width: 1024px) {
    .version-layout {
      grid-Form-columns: 1fr;
    }
  }
</style>

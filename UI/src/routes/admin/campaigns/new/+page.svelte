<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { auth } from "$lib/auth.js";
  import { getForms, getForm } from "$lib/api.js";
  import Spinner from "$lib/components/Spinner.svelte";
  import { translations_store } from "$lib/i18n/index.js";
  import { toast } from "$lib/toast.js";

  $: t = $translations_store;

  let campaign = {
    name: "",
    description: "",
    form_id: "",
    version_id: "",
    start_date: "",
    end_date: "",
  };

  let forms = [];
  let formVersions = [];
  let loading = true;
  let saving = false;
  let error = "";

  // Check auth
  $: if (!$auth) {
    goto("/login");
  }

  // Pre-select form if form_id in query params
  $: formIdParam = $page.url.searchParams.get("form_id");

  // Load versions when form is selected
  $: if (campaign.form_id) {
    loadFormVersions(campaign.form_id);
  }

  onMount(async () => {
    await loadForms();
    if (formIdParam) {
      campaign.form_id = formIdParam;
    }
  });

  async function loadForms() {
    loading = true;
    error = "";
    try {
      const response = await getForms({});
      forms = response.forms || [];
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function loadFormVersions(formId) {
    if (!formId) {
      formVersions = [];
      campaign.version_id = "";
      return;
    }

    try {
      const response = await getForm(formId);
      formVersions = response.versions || [];

      // Auto-select if only one version
      if (formVersions.length === 1) {
        campaign.version_id = formVersions[0].version_id;
      } else if (formVersions.length > 0) {
        // Select latest version by default
        campaign.version_id = formVersions[0].version_id;
      }
    } catch (err) {
      console.error("Failed to load form versions:", err);
      formVersions = [];
    }
  }

  async function handleSave() {
    error = "";
    saving = true;

    try {
      // Validate
      if (!campaign.name.trim()) {
        throw new Error("Campaign name is required");
      }
      if (!campaign.form_id) {
        throw new Error("Please select a form");
      }
      if (!campaign.version_id) {
        throw new Error("Please select a form version");
      }

      // TODO: Implement API call
      toast.info("Campaign creation not yet implemented");

      // goto("/admin/campaigns");
    } catch (err) {
      error = err.message;
      toast.error(err.message);
    } finally {
      saving = false;
    }
  }

  function handleCancel() {
    goto("/admin/campaigns");
  }
</script>

<svelte:head>
  <title>{t("campaigns.new")} - {t("app.name")}</title>
</svelte:head>

<div class="page-header">
  <div>
    <a href="/admin/campaigns" class="back-link">← {t("campaigns.title")}</a>
    <h1>{t("campaigns.new")}</h1>
  </div>
</div>

{#if loading}
  <Spinner centered size="lg">{t("common.loading")}</Spinner>
{:else}
  <div class="form-container">
    {#if error}
      <div class="error">{error}</div>
    {/if}

    <form on:submit|preventDefault={handleSave}>
      <div class="form-group">
        <label for="name">{t("forms.name")} *</label>
        <input
          id="name"
          type="text"
          bind:value={campaign.name}
          required
          placeholder="Campaign name"
        />
      </div>

      <div class="form-group">
        <label for="description">Description</label>
        <textarea
          id="description"
          bind:value={campaign.description}
          rows="3"
          placeholder="Campaign description (optional)"
        ></textarea>
      </div>

      <div class="form-group">
        <label for="form">Form *</label>
        <select id="form" bind:value={campaign.form_id} required>
          <option value="">Select a form...</option>
          {#each forms as form}
            <option value={form.form_id}>{form.name}</option>
          {/each}
        </select>
      </div>

      {#if campaign.form_id && formVersions.length > 0}
        <div class="form-group">
          <label for="version">Form Version *</label>
          <select id="version" bind:value={campaign.version_id} required>
            {#each formVersions as version}
              <option value={version.version_id}>
                v{version.version}
                {version.version_description
                  ? `- ${version.version_description}`
                  : ""}
              </option>
            {/each}
          </select>
          {#if formVersions.length === 1}
            <small style="color: #666;">Only one version available</small>
          {/if}
        </div>
      {/if}

      <div class="form-row">
        <div class="form-group">
          <label for="start_date">Start Date</label>
          <input id="start_date" type="date" bind:value={campaign.start_date} />
        </div>

        <div class="form-group">
          <label for="end_date">End Date</label>
          <input id="end_date" type="date" bind:value={campaign.end_date} />
        </div>
      </div>

      <div class="form-actions">
        <button type="button" on:click={handleCancel} class="btn-secondary">
          {t("common.cancel")}
        </button>
        <button type="submit" class="btn-primary" disabled={saving}>
          {#if saving}<span class="spinner-small"></span>{/if}
          {saving ? t("common.saving") : t("campaigns.create")}
        </button>
      </div>
    </form>
  </div>
{/if}

<style>
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
  }

  .page-header h1 {
    margin: 0.25rem 0 0 0;
    font-size: 2rem;
    color: var(--color-text);
  }

  .back-link {
    color: var(--color-primary);
    text-decoration: none;
    font-size: 0.875rem;
    display: inline-block;
    margin-bottom: 0.5rem;
  }

  .back-link:hover {
    text-decoration: underline;
  }

  .form-container {
    max-width: 800px;
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: var(--shadow-md);
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--color-text);
  }

  .form-group input,
  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: 0.625rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-size: 1rem;
    font-family: inherit;
    box-sizing: border-box;
  }

  .form-group input:focus,
  .form-group select:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--color-border);
  }

  .error {
    padding: 1rem;
    background: #fee;
    border: 1px solid #fcc;
    border-radius: 4px;
    color: #c00;
    margin-bottom: 1.5rem;
  }

  .spinner-small {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-right: 8px;
    vertical-align: middle;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>

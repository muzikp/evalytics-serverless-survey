<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { auth } from "$lib/auth.js";
  import { getCampaign, updateCampaign, getForms, getForm } from "$lib/api.js";
  import Spinner from "$lib/components/Spinner.svelte";
  import ConfigureRespondentFieldsDialog from "$lib/components/ConfigureRespondentFieldsDialog.svelte";
  import { translations_store } from "$lib/i18n/index.js";
  import { toast } from "$lib/toast.js";

  $: t = $translations_store;
  $: campaignId = $page.params.id;

  let campaign = {
    name: "",
    public_id: "",
    description: "",
    form_id: "",
    version_id: "",
    open_on: "",
    close_on: "",
    is_public: false,
    allow_retries: true,
    email_template: "",
  };

  let forms = [];
  let formVersions = [];
  let respondents = [];
  let respondentFields = [];
  let loading = true;
  let saving = false;
  let showConfigureDialog = false;
  let error = "";

  // Check auth
  $: if (!$auth) {
    goto("/login");
  }

  // Load versions when form is selected
  $: if (campaign.form_id) {
    loadFormVersions(campaign.form_id);
  }

  onMount(async () => {
    await Promise.all([loadForms(), loadCampaign()]);
  });

  async function loadForms() {
    try {
      const response = await getForms({});
      forms = response.forms || [];
    } catch (err) {
      console.error("Failed to load forms:", err);
    }
  }

  async function loadCampaign() {
    loading = true;
    error = "";
    try {
      const data = await getCampaign(campaignId);

      // Extract title - can be string or object
      let title = data.title;
      if (typeof title === "object" && title) {
        title = title.en || title.cs || Object.values(title)[0] || "";
      }

      // Extract description
      let description = data.description || "";
      if (typeof description === "object" && description) {
        description =
          description.en ||
          description.cs ||
          Object.values(description)[0] ||
          "";
      }

      // Extract email template
      let emailTemplate = data.email_template || "";
      if (typeof emailTemplate === "object" && emailTemplate) {
        // Handle nested structure like {invite: {html: "...", subject: "..."}}
        if (emailTemplate.invite && emailTemplate.invite.html) {
          emailTemplate = emailTemplate.invite.html;
        } else {
          emailTemplate = JSON.stringify(emailTemplate, null, 2);
        }
      }

      campaign = {
        name: title,
        public_id: data.public_id || "",
        description: description,
        form_id: "", // Will be set from version_id lookup
        version_id: data.version_id,
        open_on: data.open_on ? data.open_on.split("T")[0] : "",
        close_on: data.close_on ? data.close_on.split("T")[0] : "",
        is_public: Boolean(data.is_public),
        allow_retries: Boolean(data.allow_retries),
        email_template: emailTemplate,
      };

      // Find form_id from versions
      if (data.version_id && forms.length > 0) {
        for (const form of forms) {
          const formData = await getForm(form.form_id);
          const version = formData.versions?.find(
            (v) => v.version_id === data.version_id,
          );
          if (version) {
            campaign.form_id = form.form_id;
            break;
          }
        }
      }
    } catch (err) {
      error = err.message;
      toast.error(err.message);
    } finally {
      loading = false;
    }
  }

  async function loadFormVersions(formId) {
    if (!formId) {
      formVersions = [];
      return;
    }

    try {
      const response = await getForm(formId);
      formVersions = response.versions || [];
    } catch (err) {
      console.error("Failed to load form versions:", err);
      formVersions = [];
    }
  }

  function handleConfigureFields() {
    showConfigureDialog = true;
  }

  function handleSaveFieldConfiguration(event) {
    respondentFields = event.detail.fields;
    showConfigureDialog = false;
    toast.success("Respondent fields configured");
  }

  function handleAddRespondentRow() {
    const newRow = {};
    respondentFields.forEach((field) => {
      newRow[field.name] = "";
    });
    respondents = [...respondents, newRow];
  }

  function removeRespondent(index) {
    respondents = respondents.filter((_, i) => i !== index);
  }

  function validateRespondentField(value, field) {
    if (field.required && !value) {
      return false;
    }

    if (!value) return true;

    switch (field.type) {
      case "email":
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case "number":
        return !isNaN(value) && value.trim() !== "";
      case "url":
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      case "tel":
        return /^[+]?[\d\s()-]+$/.test(value);
      default:
        return true;
    }
  }

  async function handleSave() {
    error = "";
    saving = true;

    try {
      // Validate
      if (!campaign.name.trim()) {
        alert("Campaign name is required");
        saving = false;
        return;
      }

      if (!campaign.version_id) {
        alert("Please select a form version");
        saving = false;
        return;
      }

      if (
        campaign.open_on &&
        campaign.close_on &&
        new Date(campaign.close_on) <= new Date(campaign.open_on)
      ) {
        alert("Close date must be after open date");
        saving = false;
        return;
      }

      // Validate respondents if not public
      if (!campaign.is_public && respondents.length > 0) {
        for (let i = 0; i < respondents.length; i++) {
          const resp = respondents[i];
          for (const field of respondentFields) {
            if (!validateRespondentField(resp[field.name], field)) {
              alert(`Invalid ${field.label} in row ${i + 1}`);
              saving = false;
              return;
            }
          }
        }
      }

      // Prepare campaign data
      const campaignData = {
        title: campaign.name,
        public_id: campaign.public_id || null,
        description: campaign.description || null,
        open_on: campaign.open_on || null,
        close_on: campaign.close_on || null,
        email_template: campaign.email_template || null,
      };

      await updateCampaign(campaignId, campaignData);
      toast.success("Campaign updated successfully");
      goto("/admin/campaigns");
    } catch (err) {
      error = err.message;
      toast.error(err.message);
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Edit Campaign - {t("app.name")}</title>
</svelte:head>

<div class="page-header">
  <h1>Edit Campaign</h1>
  <div class="header-actions">
    <a href="/admin/campaigns" class="btn-secondary">Cancel</a>
    <button
      class="btn-primary"
      on:click={handleSave}
      disabled={saving || loading}
    >
      {saving ? "Saving..." : "Save Changes"}
    </button>
  </div>
</div>

{#if loading}
  <Spinner centered size="lg">Loading campaign...</Spinner>
{:else if error}
  <div class="error">{error}</div>
{:else}
  <div class="form-container">
    <div class="form-section">
      <h2>Campaign Details</h2>

      <div class="form-group">
        <label for="name">Campaign Name *</label>
        <input
          id="name"
          type="text"
          bind:value={campaign.name}
          placeholder="Enter campaign name"
          required
        />
        <small>The internal name for this campaign</small>
      </div>

      <div class="form-group">
        <label for="public_id">Public Name</label>
        <input
          id="public_id"
          type="text"
          bind:value={campaign.public_id}
          placeholder="e.g., customer-feedback-2026"
        />
        <small
          >URL-friendly identifier (if empty, campaign ID will be used)</small
        >
      </div>

      <div class="form-group">
        <label for="description">Description</label>
        <textarea
          id="description"
          bind:value={campaign.description}
          placeholder="Brief description of the campaign"
          rows="3"
        ></textarea>
      </div>

      <div class="form-group">
        <label for="form_id">Form *</label>
        <select id="form_id" bind:value={campaign.form_id} required disabled>
          <option value="">Select a form</option>
          {#each forms as form}
            <option value={form.form_id}>{form.name}</option>
          {/each}
        </select>
        <small>Form cannot be changed after campaign creation</small>
      </div>

      <div class="form-group">
        <label for="version_id">Form Version *</label>
        <select id="version_id" bind:value={campaign.version_id} required>
          <option value="">Select version</option>
          {#each formVersions as version}
            <option value={version.version_id}>
              v{version.version} - {new Date(
                version.created,
              ).toLocaleDateString()}
            </option>
          {/each}
        </select>
        <small>Select which version of the form to use</small>
      </div>

      <div class="form-group">
        <label for="email_template">Email Template (HTML)</label>
        <textarea
          id="email_template"
          bind:value={campaign.email_template}
          placeholder="<h1>Hello!</h1><p>You are invited to complete our survey...</p>"
          rows="8"
        ></textarea>
        <small
          >HTML template for invitation emails. Use
          &#123;&#123;link&#125;&#125;, &#123;&#123;name&#125;&#125;, etc. as
          placeholders</small
        >
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="open_on">Open Date</label>
          <input id="open_on" type="date" bind:value={campaign.open_on} />
          <small>When respondents can start (empty = immediately)</small>
        </div>

        <div class="form-group">
          <label for="close_on">Close Date</label>
          <input id="close_on" type="date" bind:value={campaign.close_on} />
          <small>When survey closes (empty = no deadline)</small>
        </div>
      </div>

      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={campaign.is_public} />
          <span>Public survey (accessible without invitation)</span>
        </label>
        <small>If enabled, anyone with the link can access the survey</small>
      </div>

      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={campaign.allow_retries} />
          <span>Allow multiple attempts</span>
        </label>
        <small>Allow respondents to submit multiple times</small>
      </div>
    </div>

    {#if !campaign.is_public}
      <div class="form-section">
        <div class="section-header">
          <h2>Respondents</h2>
          <div class="section-actions">
            <button
              class="btn-primary"
              on:click={handleConfigureFields}
              disabled={respondents.length > 0}
            >
              ⚙️ Configure Fields
            </button>
            <button class="btn-primary" disabled> 📥 Import </button>
            <button
              class="btn-primary"
              on:click={handleAddRespondentRow}
              disabled={respondentFields.length === 0}
            >
              ➕ Add Row
            </button>
          </div>
        </div>

        <small
          style="color: var(--color-text-secondary); margin-bottom: 1rem; display: block;"
        >
          Note: Respondent management is view-only in edit mode. Use the
          campaign detail page to manage respondents.
        </small>

        {#if respondentFields.length === 0}
          <div class="empty-state">
            <p>
              Click "Configure Fields" to define the structure of the respondent
              table
            </p>
          </div>
        {:else}
          <div class="respondents-table">
            <table>
              <thead>
                <tr>
                  {#each respondentFields as field}
                    <th>
                      {field.label}
                      {#if field.required}
                        <span class="required">*</span>
                      {/if}
                    </th>
                  {/each}
                  <th style="width: 80px;">Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each respondents as respondent, index}
                  <tr>
                    {#each respondentFields as field}
                      <td>
                        <input
                          type={field.type}
                          bind:value={respondent[field.name]}
                          placeholder={field.label}
                          required={field.required}
                          readonly={field.readonly}
                          class:invalid={!validateRespondentField(
                            respondent[field.name],
                            field,
                          )}
                        />
                      </td>
                    {/each}
                    <td>
                      <button
                        class="btn-icon-danger"
                        on:click={() => removeRespondent(index)}
                        title="Remove"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>

            {#if respondents.length === 0}
              <div class="empty-state">
                <p>
                  No respondents yet. Click "Add Row" or "Import" to add
                  respondents.
                </p>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

{#if showConfigureDialog}
  <ConfigureRespondentFieldsDialog
    on:save={handleSaveFieldConfiguration}
    on:cancel={() => (showConfigureDialog = false)}
  />
{/if}

<style>
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .page-header h1 {
    margin: 0;
    font-size: 2rem;
    color: var(--color-text);
  }

  .header-actions {
    display: flex;
    gap: 1rem;
  }

  .form-container {
    max-width: 1200px;
    margin: 0 auto;
  }

  .form-section {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: var(--shadow-sm);
    margin-bottom: 2rem;
  }

  .form-section h2 {
    margin: 0 0 1.5rem 0;
    font-size: 1.5rem;
    color: var(--color-text);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .section-header h2 {
    margin: 0;
  }

  .section-actions {
    display: flex;
    gap: 0.5rem;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: var(--color-text);
  }

  input[type="text"],
  input[type="date"],
  select,
  textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-size: 1rem;
  }

  input:disabled,
  select:disabled {
    background: #f5f5f5;
    cursor: not-allowed;
  }

  small {
    display: block;
    margin-top: 0.25rem;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-weight: normal;
  }

  .checkbox-label input[type="checkbox"] {
    width: auto;
    cursor: pointer;
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--color-text-secondary);
  }

  .respondents-table {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid var(--color-border);
  }

  th {
    background: var(--color-bg-secondary);
    font-weight: 600;
  }

  .required {
    color: #c00;
  }

  td input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
  }

  td input.invalid {
    border-color: #c00;
    background: #fee;
  }

  td input:read-only {
    background: #f5f5f5;
    cursor: not-allowed;
  }

  .btn-icon-danger {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.2rem;
    padding: 0.25rem;
  }

  .btn-icon-danger:hover {
    opacity: 0.7;
  }

  .error {
    padding: 1rem;
    background: #fee;
    border: 1px solid #fcc;
    border-radius: 4px;
    color: #c00;
    margin-bottom: 1rem;
  }
</style>

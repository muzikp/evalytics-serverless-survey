<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { auth } from "$lib/auth.js";
  import { getForms, getForm, createCampaign, getCampaign, updateCampaign } from "$lib/api.js";
  import Spinner from "$lib/components/Spinner.svelte";
  import ConfigureRespondentFieldsDialog from "$lib/components/ConfigureRespondentFieldsDialog.svelte";
  import { translations_store } from "$lib/i18n/index.js";
  import { toast } from "$lib/toast.js";

  $: t = $translations_store;
  $: campaignId = $page.params.id;
  $: isNewCampaign = campaignId === 'new';
  $: pageTitle = isNewCampaign ? "Create Campaign" : "Edit Campaign";

  let campaign = {
    name: "",
    public_id: "",
    description: "",
    form_id: "",
    version_id: "",
    start_date: "",
    end_date: "",
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
  let importing = false;
  let showConfigureDialog = false;
  let error = "";
  let generatedCampaignId = ""; // For new campaigns

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
    if (isNewCampaign) {
      generatedCampaignId = generateCampaignId();
      await loadForms();
      if (formIdParam) {
        campaign.form_id = formIdParam;
      }
      loading = false;
    } else {
      await Promise.all([loadForms(), loadCampaign()]);
    }
  });

  function generateCampaignId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = '';
    for (let i = 0; i < 16; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  async function loadCampaign() {
    loading = true;
    error = "";
    try {
      const data = await getCampaign(campaignId);
      
      // Extract title - can be string or object
      let title = data.title;
      if (typeof title === 'object' && title) {
        title = title.en || title.cs || Object.values(title)[0] || '';
      }
      
      // Extract description
      let description = data.description || '';
      if (typeof description === 'object' && description) {
        description = description.en || description.cs || Object.values(description)[0] || '';
      }
      
      // Extract email template
      let emailTemplate = data.email_template || '';
      if (typeof emailTemplate === 'object' && emailTemplate) {
        if (emailTemplate.invite && emailTemplate.invite.html) {
          emailTemplate = emailTemplate.invite.html;
        } else {
          emailTemplate = JSON.stringify(emailTemplate, null, 2);
        }
      }
      
      campaign = {
        name: title,
        public_id: data.public_id || '',
        description: description,
        form_id: '', // Will be set from version_id lookup
        version_id: data.version_id,
        open_on: data.open_on ? data.open_on.split('T')[0] : '',
        close_on: data.close_on ? data.close_on.split('T')[0] : '',
        is_public: Boolean(data.is_public),
        allow_retries: Boolean(data.allow_retries),
        email_template: emailTemplate,
      };
      
      // Find form_id from versions
      if (data.version_id && forms.length > 0) {
        for (const form of forms) {
          const formData = await getForm(form.form_id);
          const version = formData.versions?.find(v => v.version_id === data.version_id);
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

  // Reactive statement for email preview
  $: emailPreview = (() => {
    // Guard: only compute if we have the necessary data
    if (!campaign || !campaign.email_template) {
      return '<p style="color: #999; text-align: center; padding: 2rem;">Email template preview will appear here</p>';
    }
    
    // Ensure all variables are available
    const surveyId = campaign.public_id || generatedCampaignId || campaignId || 'campaign-id';
    
    let html = campaign.email_template;
    
    // Get first respondent data or use defaults
    const firstRespondent = respondents?.[0] || {};
    const placeholders = {
      email: firstRespondent.email || 'user@example.com',
      name: firstRespondent.name || 'John Doe',
      link: `http://localhost:5173/survey/${surveyId}`,
      campaign_name: campaign.name || 'Survey Campaign',
      ...firstRespondent
    };
    
    // Replace all __placeholder__ with values
    Object.keys(placeholders).forEach(key => {
      const regex = new RegExp(`__${key}__`, 'g');
      html = html.replace(regex, String(placeholders[key] || ''));
    });
    
    // Replace any remaining __...__ placeholders with a placeholder text
    html = html.replace(/__([^_]+)__/g, (match, key) => {
      return `<span style="background: #ffc; padding: 2px 4px; border-radius: 2px;">${match}</span>`;
    });
    
    return html;
  })();

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
      if (
        campaign.public_id &&
        campaign.public_id.trim() &&
        !/^[a-z0-9-]+$/.test(campaign.public_id)
      ) {
        throw new Error(
          "Public name must contain only lowercase letters, numbers, and hyphens",
        );
      }
      if (!campaign.form_id) {
        throw new Error("Please select a form");
      }
      if (!campaign.version_id) {
        throw new Error("Please select a form version");
      }
      if (
        campaign.start_date &&
        campaign.end_date &&
        new Date(campaign.end_date) <= new Date(campaign.start_date)
      ) {
        throw new Error("End date must be after start date");
      }
      if (!campaign.is_public && respondents.length === 0) {
        throw new Error("Private campaigns must have at least one respondent");
      }

      // Validate respondent data
      if (!campaign.is_public && respondentFields.length > 0) {
        for (let i = 0; i < respondents.length; i++) {
          const respondent = respondents[i];
          for (const field of respondentFields) {
            if (field.required && !respondent[field.name]) {
              throw new Error(`Row ${i + 1}: ${field.label} is required`);
            }
            if (
              respondent[field.name] &&
              !validateRespondentField(respondent[field.name], field)
            ) {
              throw new Error(`Row ${i + 1}: Invalid ${field.label}`);
            }
          }
        }
      }

      // Prepare campaign data - backend expects title, not name
      const campaignData = {
        title: campaign.name,
        public_id: campaign.public_id || null,
        description: campaign.description || null,
        version_id: campaign.version_id,
        open_on: campaign.open_on || null,
        close_on: campaign.close_on || null,
        is_public: campaign.is_public ? 1 : 0,
        allow_retries: campaign.allow_retries ? 1 : 0,
        email_template: campaign.email_template || null,
      };

      if (isNewCampaign) {
        campaignData.campaign_id = generatedCampaignId;
        campaignData.respondents = respondents;
        await createCampaign(campaignData);
        toast.success("Campaign created successfully");
      } else {
        await updateCampaign(campaignId, campaignData);
        toast.success("Campaign updated successfully");
      }
      
      goto("/admin/campaigns");
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

  function handleConfigureFields() {
    showConfigureDialog = true;
  }

  function handleSaveFieldConfiguration(event) {
    respondentFields = event.detail;
    showConfigureDialog = false;
    toast.success("Field configuration saved");
  }

  function handleImportRespondents() {
    if (respondentFields.length === 0) {
      toast.error("Please configure respondent fields first");
      return;
    }
    // TODO: Open import dialog
    toast.info("Import dialog will open here");
  }

  function handleAddRespondentRow() {
    if (respondentFields.length === 0) {
      toast.error("Please configure respondent fields first");
      return;
    }
    const newRespondent = {};
    respondentFields.forEach((field) => {
      newRespondent[field.name] = "";
    });
    respondents = [...respondents, newRespondent];
  }

  function removeRespondent(index) {
    respondents = respondents.filter((_, i) => i !== index);
    toast.success("Respondent removed");
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
        return !isNaN(value);
      case "url":
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      case "tel":
        return /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/.test(
          value,
        );
      default:
        return true;
    }
  }
</script>

<svelte:head>
  <title>{pageTitle} - {t("app.name")}</title>
</svelte:head>

<div class="page-header">
  <div>
    <a href="/admin/campaigns" class="back-link">← Campaigns</a>
    <h1>{pageTitle}</h1>
  </div>
  <div class="actions">
    <button class="btn-secondary" on:click={handleCancel}>Cancel</button>
    <button
      class="btn-primary"
      on:click={handleSave}
      disabled={saving || loading}
    >
      {#if saving}
        <span class="spinner-small"></span>
      {/if}
      {saving ? "Saving..." : "Save Campaign"}
    </button>
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
        <label for="name">Campaign Name *</label>
        <input
          id="name"
          type="text"
          bind:value={campaign.name}
          required
          placeholder="Enter campaign name"
        />
      </div>

      <div class="form-group">
        <label for="public_id">Public Name</label>
        <input
          id="public_id"
          type="text"
          bind:value={campaign.public_id}
          placeholder="URL-friendly name (e.g. customer-satisfaction-2026)"
        />
        <small style="color: #666;"
          >If empty, form ID will be used in the survey URL</small
        >
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

      {#if !campaign.is_public}
        <div class="form-section">
          <h2>Email Template</h2>
          <div class="email-editor-container">
            <div class="email-editor-left">
              <label for="email_template">HTML Editor</label>
              <textarea
                id="email_template"
                bind:value={campaign.email_template}
                rows="20"
                placeholder="<html>
<body>
  <h1>Hello __name__!</h1>
  <p>You've been invited to complete our survey.</p>
  <p><a href='__link__'>Click here to start</a></p>
  <p>Survey: __campaign_name__</p>
  <p>Your email: __email__</p>
</body>
</html>"
              ></textarea>
              <small style="color: #666; margin-top: 0.5rem; display: block;">
                Available placeholders: __email__, __name__, __link__, __campaign_name__, and any custom respondent fields
              </small>
            </div>
            <div class="email-editor-right">
              <label>Preview</label>
              <div class="email-preview">
                {@html emailPreview}
              </div>
              {#if respondents.length > 0}
                <small style="color: #666; margin-top: 0.5rem; display: block;">
                  Preview using first respondent's data
                </small>
              {:else}
                <small style="color: #999; margin-top: 0.5rem; display: block;">
                  Add respondents to see preview with real data
                </small>
              {/if}
            </div>
          </div>
        </div>
      {/if}

      <div class="form-group">
        <label for="form">Form *</label>
        <select id="form" bind:value={campaign.form_id} required disabled={!isNewCampaign}>
          <option value="">Select a form...</option>
          {#each forms as form}
            <option value={form.form_id}>{form.name}</option>
          {/each}
        </select>
        {#if !isNewCampaign}
          <small style="color: #999;">Form cannot be changed after creation</small>
        {/if}
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
          <label for="open_on">Open Date</label>
          <input id="open_on" type="date" bind:value={campaign.open_on} />
          <small style="color: #666;"
            >Optional - no start restriction if empty</small
          >
        </div>

        <div class="form-group">
          <label for="close_on">Close Date</label>
          <input id="close_on" type="date" bind:value={campaign.close_on} />
          <small style="color: #666;"
            >Optional - no end restriction if empty</small
          >
        </div>
      </div>

      <div class="form-group">
        <label>
          <input type="checkbox" bind:checked={campaign.is_public} />
          Public survey (anyone with link can respond)
        </label>
        <small style="color: #666; display: block; margin-top: 0.25rem;">
          If enabled, anonymous respondents will be created automatically
        </small>
      </div>

      <div class="form-group">
        <label>
          <input type="checkbox" bind:checked={campaign.allow_retries} />
          Allow multiple attempts
        </label>
        <small style="color: #666; display: block; margin-top: 0.25rem;">
          If disabled, respondents can only complete the survey once
        </small>
      </div>

      <!-- Respondents Section -->
      {#if !campaign.is_public}
        <div class="respondents-section">
          <h3>Respondents</h3>
          <p style="color: #666; margin-bottom: 1rem;">
            Add respondents who will receive survey invitations
          </p>

          <div class="respondent-actions">
            <button
              type="button"
              class="btn-primary"
              on:click={handleConfigureFields}
            >
              ⚙️ Configure Fields
            </button>
            <button
              type="button"
              class="btn-primary"
              on:click={handleImportRespondents}
              disabled={importing || respondentFields.length === 0}
            >
              {#if importing}<span class="spinner-small"></span>{/if}
              📥 Import
            </button>
            <button
              type="button"
              class="btn-primary"
              on:click={handleAddRespondentRow}
              disabled={respondentFields.length === 0}
            >
              ➕ Add Row
            </button>
          </div>

          {#if respondentFields.length === 0}
            <div class="empty-state">
              <p style="color: #999; font-style: italic; margin-top: 1rem;">
                Configure fields first to define the structure of your
                respondent table
              </p>
            </div>
          {:else if respondents.length > 0}
            <div class="respondents-table">
              <table>
                <thead>
                  <tr>
                    {#each respondentFields as field}
                      <th>
                        {field.label}
                        {#if field.required}<span style="color: #e53935;"
                            >*</span
                          >{/if}
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
                            required={field.required}
                            class:invalid={!validateRespondentField(
                              respondent[field.name],
                              field,
                            )}
                            placeholder={field.label}
                          />
                        </td>
                      {/each}
                      <td>
                        <button
                          type="button"
                          class="btn-icon"
                          on:click={() => removeRespondent(index)}
                          title="Remove respondent"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
              <p style="margin-top: 0.5rem; color: #666;">
                {respondents.length} respondent{respondents.length !== 1
                  ? "s"
                  : ""}
              </p>
            </div>
          {:else}
            <div class="empty-state">
              <p style="color: #999; font-style: italic; margin-top: 1rem;">
                Click "Add Row" to start adding respondents
              </p>
            </div>
          {/if}
        </div>
      {/if}

      <div class="form-actions">
        <button type="button" on:click={handleCancel} class="btn-secondary">
          Cancel
        </button>
        <button type="submit" class="btn-primary" disabled={saving}>
          {#if saving}<span class="spinner-small"></span>{/if}
          {saving ? "Saving..." : "Save Campaign"}
        </button>
      </div>
    </form>
  </div>
{/if}

<ConfigureRespondentFieldsDialog
  bind:show={showConfigureDialog}
  existingFields={respondentFields}
  on:save={handleSaveFieldConfiguration}
/>

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

  .btn-primary,
  .btn-secondary {
    padding: 0.625rem 1.25rem;
    border-radius: 4px;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-primary {
    background-color: #4a90e2;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: #3a7bc8;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background-color: #f0f0f0;
    color: #333;
  }

  .btn-secondary:hover:not(:disabled) {
    background-color: #e0e0e0;
  }

  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

  .email-editor-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    margin-top: 1rem;
  }

  .email-editor-left,
  .email-editor-right {
    display: flex;
    flex-direction: column;
  }

  .email-editor-left label,
  .email-editor-right label {
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: var(--color-text);
  }

  .email-editor-left textarea {
    flex: 1;
    font-family: 'Courier New', monospace;
    font-size: 0.9rem;
    padding: 1rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    resize: vertical;
  }

  .email-preview {
    flex: 1;
    padding: 1.5rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: white;
    overflow-y: auto;
    min-height: 400px;
  }

  .respondents-section {
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 2px solid var(--color-border);
  }

  .respondents-section h3 {
    margin: 0 0 0.5rem 0;
    color: var(--color-text);
  }

  .respondent-actions {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .respondents-table {
    margin-top: 1rem;
    overflow-x: auto;
  }

  .respondents-table table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid var(--color-border);
  }

  .respondents-table th,
  .respondents-table td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid var(--color-border);
  }

  .respondents-table th {
    background: #f5f5f5;
    font-weight: 600;
    font-size: 0.875rem;
  }

  .respondents-table td {
    font-size: 0.875rem;
  }

  .respondents-table input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.875rem;
  }

  .respondents-table input:focus {
    outline: none;
    border-color: #4a90e2;
  }

  .respondents-table input.invalid {
    border-color: #e53935;
    background-color: #ffebee;
  }

  .empty-state {
    text-align: center;
    padding: 2rem 1rem;
  }

  .respondents-table code {
    background: #f0f0f0;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.8rem;
  }

  .btn-icon {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.2rem;
    padding: 0.25rem;
  }

  .btn-icon:hover {
    opacity: 0.7;
  }

  .form-group label input[type="checkbox"] {
    width: auto;
    margin-right: 0.5rem;
  }
</style>

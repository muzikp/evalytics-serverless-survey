<script>
  export let campaign = {};
  export let forms = [];
  export let formVersions = [];
  export let isNewCampaign = false;
  export let generatedCampaignId = "";
</script>

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
  <small style="color: #666; display: block; margin-top: 0.25rem;">
    {#if isNewCampaign && generatedCampaignId}
      Auto-generated ID: <code>{generatedCampaignId}</code>
    {:else if campaign.public_id}
      Survey URL: <code>/survey/{campaign.public_id}</code>
    {/if}
  </small>
</div>

<div class="form-group">
  <label for="description">Description</label>
  <textarea
    id="description"
    bind:value={campaign.description}
    rows="3"
    placeholder="Optional campaign description"
  ></textarea>
</div>

<div class="form-group">
  <label for="form">Form *</label>
  <select id="form" bind:value={campaign.form_id} required>
    <option value="">Select a form</option>
    {#each forms as form}
      <option value={form.form_id}>{form.name}</option>
    {/each}
  </select>
</div>

<div class="form-group">
  <label for="version">Form Version *</label>
  <select
    id="version"
    bind:value={campaign.version_id}
    required
    disabled={!campaign.form_id}
  >
    <option value="">Select a version</option>
    {#each formVersions as version}
      <option value={version.version_id}>
        v{version.version} - {version.name || "Unnamed"}
      </option>
    {/each}
  </select>
</div>

<div class="form-row">
  <div class="form-group">
    <label for="start_date">Start Date</label>
    <input id="start_date" type="date" bind:value={campaign.open_on} />
  </div>
  <div class="form-group">
    <label for="end_date">End Date</label>
    <input id="end_date" type="date" bind:value={campaign.close_on} />
  </div>
</div>

<div class="form-group">
  <label>
    <input type="checkbox" bind:checked={campaign.is_public} />
    Public Survey
  </label>
  <small style="color: #666; display: block; margin-top: 0.25rem;">
    If enabled, anyone with the link can access the survey without a token
  </small>
</div>

<div class="form-group">
  <label>
    <input type="checkbox" bind:checked={campaign.allow_retries} />
    Allow Multiple Attempts
  </label>
  <small style="color: #666; display: block; margin-top: 0.25rem;">
    If enabled, respondents can submit the survey multiple times
  </small>
</div>

<div class="form-group">
  <label>
    <input type="checkbox" bind:checked={campaign.response_persistence} />
    Save Progress Automatically
  </label>
  <small style="color: #666; display: block; margin-top: 0.25rem;">
    If enabled, respondents will see their previous answers when reopening the
    survey
  </small>
</div>

<div class="form-group">
  <label>
    <input type="checkbox" bind:checked={campaign.can_edit_after_submit} />
    Allow editing after submit
  </label>
  <small style="color: #666; display: block; margin-top: 0.25rem;">
    If enabled, respondents can reopen and edit their submitted responses
  </small>
</div>

<div class="form-group">
  <label>
    <input type="checkbox" bind:checked={campaign.can_reopen_after_submit} />
    Can reopen after submit
  </label>
  <small style="color: #666; display: block; margin-top: 0.25rem;">
    If disabled, tokens will be invalidated after submission and redirect to
    homepage
  </small>
</div>

<style>
  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--color-text);
  }

  .form-group input[type="text"],
  .form-group input[type="date"],
  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-size: 1rem;
  }

  .form-group input:focus,
  .form-group select:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .form-group select:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
  }

  .form-group textarea {
    resize: vertical;
    font-family: inherit;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .form-group label input[type="checkbox"] {
    width: auto;
    margin-right: 0.5rem;
  }

  code {
    background: #f4f4f4;
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    font-size: 0.875rem;
  }
</style>

<script>
  import { createEventDispatcher } from "svelte";
  import Spinner from "./Spinner.svelte";

  const dispatch = createEventDispatcher();

  export let respondents = [];
  export let respondentFields = [];
  export let respondentsLoading = false;
  export let importing = false;
  export let autoGenerateToken = true;
  export let campaign = {};

  function handleConfigureFields() {
    dispatch("configure");
  }

  function handleImportRespondents() {
    dispatch("import");
  }

  function handleAddRow() {
    dispatch("addRow");
  }

  function removeRespondent(index) {
    dispatch("remove", { index });
  }

  function copySurveyLink(respondent) {
    dispatch("copyLink", { respondent });
  }

  function validateField(value, field) {
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
        return /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/.test(value);
      default:
        return true;
    }
  }
</script>

<p style="color: #666; margin-bottom: 1rem;">
  Add respondents who will receive survey invitations
</p>

<div class="respondent-actions">
  <button type="button" class="btn-primary" on:click={handleConfigureFields}>
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
    on:click={handleAddRow}
    disabled={respondentFields.length === 0}
  >
    ➕ Add Row
  </button>
</div>

<div class="form-group" style="margin-top: 1rem;">
  <label>
    <input type="checkbox" bind:checked={autoGenerateToken} />
    Automatically generate tokens for new respondents
  </label>
  <small style="color: #666; display: block; margin-top: 0.25rem;">
    When enabled, tokens will be auto-generated when adding new rows
  </small>
</div>

{#if respondentFields.length === 0}
  <div class="empty-state">
    <p style="color: #999; font-style: italic; margin-top: 1rem;">
      Configure fields first to define the structure of your respondent table
    </p>
  </div>
{:else if respondentsLoading}
  <div class="loading-state">
    <Spinner size="md" />
    <p>Loading respondents...</p>
  </div>
{:else if respondents.length > 0}
  <div class="respondents-table">
    <table>
      <thead>
        <tr>
          {#each respondentFields as field}
            <th>
              {field.label}
              {#if field.required}<span style="color: #e53935;">*</span>{/if}
            </th>
          {/each}
          <th style="width: 100px; text-align: center;">Actions</th>
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
                  class:invalid={!validateField(respondent[field.name], field)}
                  placeholder={field.label}
                />
              </td>
            {/each}
            <td class="action-buttons">
              <button
                type="button"
                class="btn-icon"
                on:click={() => copySurveyLink(respondent)}
                title="Copy survey link"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect
                    x="2"
                    y="2"
                    width="8"
                    height="10"
                    rx="1"
                    stroke="currentColor"
                    fill="none"
                    stroke-width="1.5"
                  />
                  <path
                    d="M6 2V1C6 0.4 6.4 0 7 0H13C13.6 0 14 0.4 14 1V11C14 11.6 13.6 12 13 12H12"
                    stroke="currentColor"
                    fill="none"
                    stroke-width="1.5"
                  />
                </svg>
              </button>
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
      {respondents.length} respondent{respondents.length !== 1 ? "s" : ""}
    </p>
  </div>
{:else}
  <div class="empty-state">
    <p style="color: #999; font-style: italic; margin-top: 1rem;">
      Click "Add Row" to start adding respondents
    </p>
  </div>
{/if}

<style>
  .respondent-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .btn-primary {
    padding: 0.5rem 1rem;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-dark);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .form-group label input[type="checkbox"] {
    width: auto;
    margin-right: 0.5rem;
  }

  .respondents-table {
    overflow-x: auto;
    margin-top: 1rem;
  }

  .respondents-table table {
    width: 100%;
    border-collapse: collapse;
    background: white;
  }

  .respondents-table th,
  .respondents-table td {
    padding: 0.75rem;
    text-align: left;
    border: 1px solid var(--color-border);
  }

  .respondents-table th {
    background: #f8f9fa;
    font-weight: 600;
    font-size: 0.875rem;
  }

  .respondents-table input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-size: 0.875rem;
  }

  .respondents-table input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .respondents-table input.invalid {
    border-color: #e53935;
    background-color: #ffebee;
  }

  .btn-icon {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.2rem;
    padding: 0.25rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .btn-icon:hover {
    opacity: 0.7;
  }

  .btn-icon svg {
    color: var(--color-primary);
  }

  .action-buttons {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    justify-content: center;
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

  .empty-state,
  .loading-state {
    text-align: center;
    padding: 2rem;
  }
</style>

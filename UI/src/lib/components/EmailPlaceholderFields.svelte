<script>
  import { createEventDispatcher, onMount } from "svelte";

  const dispatch = createEventDispatcher();

  export let emailTemplateFields = [];

  // Ensure all fields have the new structure
  onMount(() => {
    emailTemplateFields = emailTemplateFields.map((field) => {
      // If field doesn't have value property, migrate it
      if (!field.value && (field.cs || field.en || field.de)) {
        return {
          id: field.id,
          name: field.name,
          type: "dictionary",
          value: {
            cs: field.cs || "",
            en: field.en || "",
            de: field.de || "",
          },
        };
      }
      // If value doesn't exist at all, create empty one
      if (!field.value) {
        field.value = { cs: "", en: "", de: "" };
      }
      return field;
    });
  });

  function addField() {
    dispatch("add");
  }

  function removeField(index) {
    dispatch("remove", { index });
  }
</script>

<div class="form-group">
  <div
    style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;"
  >
    <div style="display: flex; align-items: center; gap: 0.5rem;">
      <label style="margin: 0;">Custom Email Placeholders</label>
      <span
        class="help-icon"
        title="Create custom placeholders with translations for different languages. Use these in your email template."
        >ℹ️</span
      >
    </div>
    <button
      type="button"
      class="btn-secondary"
      style="padding: 0.375rem 0.75rem; font-size: 0.875rem;"
      on:click={addField}
    >
      ➕ Add Field
    </button>
  </div>

  {#if emailTemplateFields.length > 0}
    <div class="email-fields-table">
      <table>
        <thead>
          <tr>
            <th style="width: 25%;">ID</th>
            <th style="width: 25%;">Placeholder Name</th>
            <th style="width: 16%;">Czech (cs)</th>
            <th style="width: 16%;">English (en)</th>
            <th style="width: 13%;">German (de)</th>
            <th style="width: 5%; text-align: center;">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each emailTemplateFields as field, index}
            <tr>
              <td>
                <input
                  type="text"
                  value={field.id}
                  disabled
                  readonly
                  style="width: 100%; background: #f5f5f5; cursor: not-allowed;"
                />
              </td>
              <td>
                <input
                  type="text"
                  bind:value={field.name}
                  placeholder="e.g. Greeting, Footer, Introduction"
                  style="width: 100%;"
                />
              </td>
              <td>
                <input
                  type="text"
                  bind:value={field.value.cs}
                  placeholder="Dobrý den"
                  style="width: 100%;"
                />
              </td>
              <td>
                <input
                  type="text"
                  bind:value={field.value.en}
                  placeholder="Hello"
                  style="width: 100%;"
                />
              </td>
              <td>
                <input
                  type="text"
                  bind:value={field.value.de}
                  placeholder="Guten Tag"
                  style="width: 100%;"
                />
              </td>
              <td style="text-align: center;">
                <button
                  type="button"
                  class="btn-icon"
                  on:click={() => removeField(index)}
                  title="Remove field"
                >
                  🗑️
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p
      style="color: #999; font-style: italic; padding: 1rem; background: #f9f9f9; border-radius: 4px;"
    >
      No custom placeholders defined. Click "Add Field" to create one.
    </p>
  {/if}
</div>

<style>
  .form-group {
    margin-bottom: 1.5rem;
  }

  .btn-secondary {
    padding: 0.5rem 1rem;
    background: white;
    color: var(--color-primary);
    border: 1px solid var(--color-primary);
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .btn-secondary:hover {
    background: #f5f5f5;
  }

  .email-fields-table {
    overflow-x: auto;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: white;
  }

  .email-fields-table table {
    width: 100%;
    border-collapse: collapse;
  }

  .email-fields-table th {
    background: #f8f9fa;
    padding: 0.75rem;
    text-align: left;
    font-weight: 600;
    font-size: 0.875rem;
    color: #495057;
    border-bottom: 2px solid var(--color-border);
  }

  .email-fields-table td {
    padding: 0.5rem;
    border-bottom: 1px solid #f0f0f0;
  }

  .email-fields-table td input {
    padding: 0.5rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-size: 0.875rem;
  }

  .email-fields-table td input:focus {
    outline: none;
    border-color: var(--color-primary);
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

  .help-icon {
    cursor: help;
    font-size: 1rem;
    opacity: 0.6;
    transition: opacity 0.2s;
  }

  .help-icon:hover {
    opacity: 1;
  }
</style>

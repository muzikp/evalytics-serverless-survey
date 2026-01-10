<script>
  import { createEventDispatcher } from "svelte";
  import { toast } from "$lib/toast.js";

  const dispatch = createEventDispatcher();

  export let show = false;
  export let existingFields = [];

  let fields = [];

  // Initialize fields when dialog opens
  $: if (show && fields.length === 0) {
    if (existingFields && existingFields.length > 0) {
      fields = JSON.parse(JSON.stringify(existingFields));
    } else {
      // Default fields
      fields = [
        {
          id: "email",
          label: "Email",
          type: "email",
          required: true,
          readonly: true,
        },
        {
          id: "token",
          label: "Token",
          type: "text",
          required: false,
          readonly: true,
        },
      ];
    }
  }

  let errors = {};

  const fieldTypes = [
    { value: "text", label: "Text" },
    { value: "email", label: "Email" },
    { value: "number", label: "Number" },
    { value: "date", label: "Date" },
    { value: "tel", label: "Phone" },
    { value: "url", label: "URL" },
    { value: "json", label: "JSON" },
    { value: "dictionary", label: "Dictionary (Multilingual)" },
  ];

  function addField() {
    fields = [
      ...fields,
      {
        id: `field_ra_${Date.now()}`,
        label: "",
        type: "text",
        required: false,
        readonly: false,
      },
    ];
  }

  function removeField(index) {
    // Don't allow removing default fields (email, token)
    if (fields[index].readonly) {
      toast.error("Cannot remove default fields");
      return;
    }
    fields = fields.filter((_, i) => i !== index);
  }

  function validate() {
    errors = {};

    // Check for empty labels
    fields.forEach((field, index) => {
      if (!field.readonly) {
        if (!field.label.trim()) {
          errors[`label_${index}`] = "Field label is required";
        }
      }
    });

    return Object.keys(errors).length === 0;
  }

  function handleSubmit() {
    if (!validate()) {
      toast.error("Please fix validation errors");
      return;
    }

    dispatch("save", fields);
    handleClose();
  }

  function handleClose() {
    show = false;
    errors = {};
  }

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }
</script>

{#if show}
  <div class="modal-backdrop" on:click={handleBackdropClick}>
    <div class="modal-content">
      <div class="modal-header">
        <h3>Configure Respondent Fields</h3>
        <button type="button" class="close-btn" on:click={handleClose}>
          ×
        </button>
      </div>

      <div class="modal-body">
        <div
          style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.5rem;"
        >
          <span class="description" style="margin: 0;"
            >Define the structure of your respondent table</span
          >
          <span
            class="help-icon"
            title="Configure the structure of the respondent table. Email and Token are default fields and cannot be modified. Add custom fields to capture additional data."
            >ℹ️</span
          >
        </div>

        <div class="fields-list">
          {#each fields as field, index}
            <div class="field-row">
              <div class="field-inputs">
                <div class="input-group">
                  <label>
                    Field ID
                    <input
                      type="text"
                      value={field.id}
                      disabled
                      class="id-display"
                    />
                  </label>
                </div>

                <div class="input-group">
                  <label>
                    Field Label
                    <input
                      type="text"
                      bind:value={field.label}
                      placeholder="e.g. Company Name"
                      disabled={field.readonly}
                      class:error={errors[`label_${index}`]}
                    />
                  </label>
                  {#if errors[`label_${index}`]}
                    <span class="error-text">{errors[`label_${index}`]}</span>
                  {/if}
                </div>

                <div class="input-group">
                  <label>
                    Type
                    <select bind:value={field.type} disabled={field.readonly}>
                      {#each fieldTypes as type}
                        <option value={type.value}>{type.label}</option>
                      {/each}
                    </select>
                  </label>
                </div>

                <div class="input-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      bind:checked={field.required}
                      disabled={field.readonly}
                    />
                    Required
                  </label>
                </div>
              </div>

              <div class="field-actions">
                {#if !field.readonly}
                  <button
                    type="button"
                    class="btn-icon btn-remove"
                    on:click={() => removeField(index)}
                    title="Remove field"
                  >
                    🗑️
                  </button>
                {:else}
                  <span class="default-badge">Default</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>

        <button type="button" class="btn-add-field" on:click={addField}>
          ➕ Add Custom Field
        </button>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn-secondary" on:click={handleClose}>
          Cancel
        </button>
        <button type="button" class="btn-primary" on:click={handleSubmit}>
          Save Configuration
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: white;
    border-radius: 8px;
    width: 90%;
    max-width: 900px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e0e0e0;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.25rem;
    color: #333;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 2rem;
    color: #999;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background-color: #f0f0f0;
    color: #333;
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .description {
    color: #666;
    margin-bottom: 1.5rem;
    font-size: 0.95rem;
  }

  .error-message {
    background-color: #fee;
    border: 1px solid #fcc;
    color: #c33;
    padding: 0.75rem;
    border-radius: 4px;
    margin-bottom: 1rem;
  }

  .fields-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .field-row {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    background-color: #f9f9f9;
    border-radius: 6px;
    border: 1px solid #e0e0e0;
  }

  .field-inputs {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1fr 120px auto;
    gap: 1rem;
    align-items: start;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .input-group label {
    font-size: 0.85rem;
    font-weight: 500;
    color: #555;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .checkbox-group {
    justify-content: flex-end;
    padding-top: 1.5rem;
  }

  .checkbox-group label {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .checkbox-group input[type="checkbox"] {
    width: auto;
    margin: 0;
  }

  input[type="text"],
  input[type="email"],
  select {
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.95rem;
    transition: border-color 0.2s;
  }

  input[type="text"]:focus,
  input[type="email"]:focus,
  select:focus {
    outline: none;
    border-color: #4a90e2;
  }

  input[type="text"]:disabled,
  input[type="email"]:disabled,
  select:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
  }

  input.error {
    border-color: #c33;
  }

  .error-text {
    color: #c33;
    font-size: 0.8rem;
  }

  .field-actions {
    display: flex;
    align-items: center;
  }

  .btn-icon {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.2rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .btn-remove:hover {
    background-color: #fee;
  }

  .default-badge {
    padding: 0.25rem 0.75rem;
    background-color: #e3f2fd;
    color: #1976d2;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .btn-add-field {
    background-color: #f0f0f0;
    border: 2px dashed #ccc;
    color: #666;
    padding: 0.75rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.95rem;
    font-weight: 500;
    transition: all 0.2s;
    width: 100%;
  }

  .btn-add-field:hover {
    background-color: #e8e8e8;
    border-color: #999;
    color: #333;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1.5rem;
    border-top: 1px solid #e0e0e0;
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
  }

  .btn-primary {
    background-color: #4a90e2;
    color: white;
  }

  .btn-primary:hover {
    background-color: #3a7bc8;
  }

  .btn-secondary {
    background-color: #f0f0f0;
    color: #333;
  }

  .btn-secondary:hover {
    background-color: #e0e0e0;
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

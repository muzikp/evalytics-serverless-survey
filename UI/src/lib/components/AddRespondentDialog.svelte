<script>
  import { createEventDispatcher } from "svelte";
  import { toast } from "$lib/toast.js";

  const dispatch = createEventDispatcher();

  export let show = false;

  let email = "";
  let token = "";
  let customFields = [];
  let errors = {};

  function addCustomField() {
    customFields = [...customFields, { name: "", value: "", type: "text" }];
  }

  function removeCustomField(index) {
    customFields = customFields.filter((_, i) => i !== index);
  }

  function validate() {
    errors = {};

    if (!email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Invalid email format";
    }

    // Validate custom field names are unique and not empty
    const fieldNames = customFields.map((f) => f.name.trim()).filter((n) => n);
    const uniqueNames = new Set(fieldNames);
    if (fieldNames.length !== uniqueNames.size) {
      errors.customFields = "Field names must be unique";
    }

    customFields.forEach((field, index) => {
      if (field.name.trim() && !field.value.trim()) {
        errors[`customField_${index}`] = "Value required";
      }
    });

    return Object.keys(errors).length === 0;
  }

  function handleSubmit() {
    if (!validate()) {
      toast.error("Please fix validation errors");
      return;
    }

    const customData = {};
    customFields.forEach((field) => {
      if (field.name.trim() && field.value.trim()) {
        customData[field.name.trim()] = field.value.trim();
      }
    });

    const respondent = {
      email: email.trim(),
      token: token.trim() || undefined,
      custom_data: Object.keys(customData).length > 0 ? customData : undefined,
    };

    dispatch("add", respondent);
    handleClose();
  }

  function handleClose() {
    show = false;
    email = "";
    token = "";
    customFields = [];
    errors = {};
  }

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }
</script>

{#if show}
  <div class="modal-backdrop" on:click={handleBackdropClick}>
    <div class="modal">
      <div class="modal-header">
        <h2>Add Respondent</h2>
        <button class="close-btn" on:click={handleClose}>&times;</button>
      </div>

      <form on:submit|preventDefault={handleSubmit}>
        <div class="modal-body">
          <div class="form-group">
            <label for="email">
              Email <span class="required">*</span>
            </label>
            <input
              id="email"
              type="email"
              bind:value={email}
              placeholder="respondent@example.com"
              class:error={errors.email}
            />
            {#if errors.email}
              <span class="error-text">{errors.email}</span>
            {/if}
          </div>

          <div class="form-group">
            <label for="token">
              Token <span class="optional">(optional)</span>
            </label>
            <input
              id="token"
              type="text"
              bind:value={token}
              placeholder="Leave empty to auto-generate"
            />
            <small
              >If empty, a unique token will be generated automatically</small
            >
          </div>

          <div class="custom-fields-section">
            <div class="section-header">
              <h3>Custom Data</h3>
              <button type="button" class="btn-small" on:click={addCustomField}>
                + Add Field
              </button>
            </div>

            {#if errors.customFields}
              <div class="error-text">{errors.customFields}</div>
            {/if}

            {#if customFields.length > 0}
              <div class="custom-fields-list">
                {#each customFields as field, index}
                  <div class="custom-field-row">
                    <input
                      type="text"
                      bind:value={field.name}
                      placeholder="Field name (e.g., firstname)"
                      class="field-name"
                    />
                    <input
                      type="text"
                      bind:value={field.value}
                      placeholder="Value"
                      class="field-value"
                      class:error={errors[`customField_${index}`]}
                    />
                    <button
                      type="button"
                      class="btn-icon"
                      on:click={() => removeCustomField(index)}
                      title="Remove"
                    >
                      🗑️
                    </button>
                  </div>
                  {#if errors[`customField_${index}`]}
                    <span class="error-text"
                      >{errors[`customField_${index}`]}</span
                    >
                  {/if}
                {/each}
              </div>
            {:else}
              <p class="no-fields">
                No custom fields yet. Click "Add Field" to add optional data.
              </p>
            {/if}
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn-secondary" on:click={handleClose}>
            Cancel
          </button>
          <button type="submit" class="btn-primary">Add Respondent</button>
        </div>
      </form>
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
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: white;
    border-radius: 8px;
    width: 90%;
    max-width: 600px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e0e0e0;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 2rem;
    cursor: pointer;
    color: #666;
    padding: 0;
    line-height: 1;
  }

  .close-btn:hover {
    color: #333;
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }

  .required {
    color: #e53e3e;
  }

  .optional {
    color: #666;
    font-weight: normal;
    font-size: 0.875rem;
  }

  .form-group input {
    width: 100%;
    padding: 0.625rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
    box-sizing: border-box;
  }

  .form-group input.error {
    border-color: #e53e3e;
  }

  .form-group input:focus {
    outline: none;
    border-color: #4a90e2;
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
  }

  .form-group small {
    display: block;
    margin-top: 0.25rem;
    color: #666;
    font-size: 0.875rem;
  }

  .error-text {
    display: block;
    color: #e53e3e;
    font-size: 0.875rem;
    margin-top: 0.25rem;
  }

  .custom-fields-section {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e0e0e0;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .section-header h3 {
    margin: 0;
    font-size: 1.125rem;
  }

  .btn-small {
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
    background: white;
    color: #4a90e2;
    border: 1px solid #4a90e2;
    border-radius: 4px;
    cursor: pointer;
  }

  .btn-small:hover {
    background: #4a90e2;
    color: white;
  }

  .custom-fields-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .custom-field-row {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 0.5rem;
    align-items: center;
  }

  .field-name,
  .field-value {
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.875rem;
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

  .no-fields {
    color: #999;
    font-style: italic;
    text-align: center;
    padding: 1rem;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid #e0e0e0;
  }

  .btn-secondary,
  .btn-primary {
    padding: 0.625rem 1.25rem;
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
    border: none;
  }

  .btn-secondary {
    background: white;
    color: #333;
    border: 1px solid #ddd;
  }

  .btn-secondary:hover {
    background: #f5f5f5;
  }

  .btn-primary {
    background: #4a90e2;
    color: white;
  }

  .btn-primary:hover {
    background: #357abd;
  }
</style>

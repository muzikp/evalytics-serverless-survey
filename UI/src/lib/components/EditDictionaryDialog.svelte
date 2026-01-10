<script>
  import { createEventDispatcher } from "svelte";
  import Spinner from "./Spinner.svelte";

  const dispatch = createEventDispatcher();

  export let show = false;
  export let respondent = null;
  export let field = null;
  export let languages = ["en", "cs", "de"];

  let values = {};
  let isLoading = true;

  $: if (show && respondent && field) {
    console.log("EditDictionaryDialog: Initializing values", {
      fieldId: field.id,
      fieldDataKey: field.dataKey,
      respondentData: respondent,
    });
    isLoading = true;
    initializeValues();
  }

  function initializeValues() {
    const dataKey = field.dataKey || field.id;
    const currentValue = respondent[dataKey];

    console.log("initializeValues:", {
      dataKey,
      currentValue,
      currentValueType: typeof currentValue,
    });

    if (typeof currentValue === "string") {
      try {
        values = JSON.parse(currentValue);
      } catch {
        values = {};
      }
    } else if (typeof currentValue === "object" && currentValue !== null) {
      values = { ...currentValue };
    } else {
      values = {};
    }

    // Ensure all languages exist
    languages.forEach((lang) => {
      if (!values[lang]) {
        values[lang] = "";
      }
    });

    console.log("initializeValues result:", values);

    // Use setTimeout to ensure values are rendered before hiding spinner
    setTimeout(() => {
      isLoading = false;
    }, 0);
  }

  function handleSave() {
    // Remove empty values
    const cleanedValues = {};
    Object.keys(values).forEach((lang) => {
      if (values[lang] && values[lang].trim()) {
        cleanedValues[lang] = values[lang].trim();
      }
    });

    dispatch("save", {
      respondent,
      field,
      value: cleanedValues,
    });
    handleClose();
  }

  function handleClose() {
    show = false;
    values = {};
    isLoading = true;
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
        <h3>Edit {field?.label || "Field"} - Multilingual Values</h3>
        <button type="button" class="close-btn" on:click={handleClose}>
          ×
        </button>
      </div>

      <div class="modal-body">
        {#if isLoading}
          <div
            style="display: flex; justify-content: center; align-items: center; min-height: 200px;"
          >
            <Spinner />
          </div>
        {:else}
          <p class="description">
            Enter the value for this field in each language used in your survey.
          </p>

          <div class="language-fields">
            {#each languages as lang}
              <div class="language-field">
                <label>
                  <strong>{lang.toUpperCase()}</strong>
                  <input
                    type="text"
                    bind:value={values[lang]}
                    placeholder="Enter value for {lang.toUpperCase()}"
                  />
                </label>
              </div>
            {/each}
          </div>

          <div class="preview">
            <strong>Preview (JSON):</strong>
            <pre>{JSON.stringify(values, null, 2)}</pre>
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button type="button" class="btn-secondary" on:click={handleClose}>
          Cancel
        </button>
        <button type="button" class="btn-primary" on:click={handleSave}>
          Save
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
    max-width: 600px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
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
    font-weight: 600;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 2rem;
    cursor: pointer;
    color: #666;
    line-height: 1;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
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
  }

  .language-fields {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .language-field label {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .language-field strong {
    color: #333;
    font-size: 0.875rem;
  }

  .language-field input {
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
  }

  .language-field input:focus {
    outline: none;
    border-color: var(--color-primary, #007bff);
  }

  .preview {
    background: #f5f5f5;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 1rem;
  }

  .preview strong {
    display: block;
    margin-bottom: 0.5rem;
    color: #666;
    font-size: 0.875rem;
  }

  .preview pre {
    margin: 0;
    font-family: monospace;
    font-size: 0.875rem;
    color: #333;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid #e0e0e0;
  }

  .btn-secondary,
  .btn-primary {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .btn-secondary {
    background: #f0f0f0;
    color: #333;
  }

  .btn-secondary:hover {
    background: #e0e0e0;
  }

  .btn-primary {
    background: var(--color-primary, #007bff);
    color: white;
  }

  .btn-primary:hover {
    background: var(--color-primary-dark, #0056b3);
  }
</style>

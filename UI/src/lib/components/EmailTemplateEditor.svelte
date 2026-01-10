<script>
  import { onMount, onDestroy, tick } from "svelte";
  import { createEventDispatcher } from "svelte";
  import loader from "@monaco-editor/loader";
  import Spinner from "./Spinner.svelte";
  import EmailPreviewModal from "./EmailPreviewModal.svelte";

  const dispatch = createEventDispatcher();

  export let emailTemplate = "";
  export let availablePlaceholders = [];
  export let editorsLoading = false;
  export let emailTemplateFields = [];
  export let respondents = [];
  export let respondentFields = [];
  export let languages = ["en", "cs", "de"];
  export let campaign = {};

  let monacoEditor;
  let monacoContainer;
  let selectedLanguage = "en";
  let selectedRespondentEmail = "";
  let showPreview = false;
  let emailTitleInput;

  // Auto-select first respondent when list changes
  $: if (respondents.length > 0 && !selectedRespondentEmail) {
    selectedRespondentEmail = respondents[0]?.email || "";
  }

  // Parse JSON template into separate title and body
  let emailTitle = "";
  let emailBody = "";

  $: {
    if (emailTemplate) {
      try {
        const parsed = JSON.parse(emailTemplate);
        emailTitle = parsed.title || "";
        emailBody = parsed.body || "";

        // Update Monaco editor if it exists and value changed
        if (monacoEditor && monacoEditor.getValue() !== emailBody) {
          monacoEditor.setValue(emailBody);
        }
      } catch (err) {
        // If not JSON, treat as legacy plain HTML
        emailBody = emailTemplate;
        emailTitle = "";
      }
    }
  }

  // Combine title and body into JSON and dispatch
  function updateTemplate() {
    const template = {
      title: emailTitle,
      body: emailBody,
    };
    emailTemplate = JSON.stringify(template);
    dispatch("change", { value: emailTemplate });
  }

  $: selectedRespondent =
    respondents.find((r) => r.email === selectedRespondentEmail) || null;
  $: console.log(
    "Respondents in editor:",
    respondents.length,
    respondents.map((r) => r.email),
  );

  function insertPlaceholder(placeholder, target = "body") {
    if (!placeholder) return;

    if (target === "title" && emailTitleInput) {
      const start = emailTitleInput.selectionStart;
      const end = emailTitleInput.selectionEnd;
      const before = emailTitle.substring(0, start);
      const after = emailTitle.substring(end);
      emailTitle = before + placeholder + after;
      updateTemplate();

      // Set cursor position after placeholder
      tick().then(() => {
        emailTitleInput.focus();
        emailTitleInput.setSelectionRange(
          start + placeholder.length,
          start + placeholder.length,
        );
      });
    } else if (target === "body" && monacoEditor) {
      const selection = monacoEditor.getSelection();
      const id = { major: 1, minor: 1 };
      const op = {
        identifier: id,
        range: selection,
        text: placeholder,
        forceMoveMarkers: true,
      };
      monacoEditor.executeEdits("insert-placeholder", [op]);
      monacoEditor.focus();
    }
  }
  function handlePreview() {
    showPreview = true;
  }

  onMount(async () => {
    editorsLoading = true;

    try {
      const monaco = await loader.init();

      monacoEditor = monaco.editor.create(monacoContainer, {
        value: emailBody || "",
        language: "html",
        theme: "vs",
        minimap: { enabled: false },
        lineNumbers: "on",
        wordWrap: "on",
        automaticLayout: true,
        scrollBeyondLastLine: false,
        fontSize: 14,
      });

      monacoEditor.onDidChangeModelContent(() => {
        emailBody = monacoEditor.getValue();
        updateTemplate();
      });
    } catch (error) {
      console.error("Failed to initialize Monaco editor:", error);
    } finally {
      editorsLoading = false;
    }
  });

  onDestroy(() => {
    if (monacoEditor) {
      monacoEditor.dispose();
    }
  });
</script>

<EmailPreviewModal
  bind:show={showPreview}
  {emailTemplate}
  {emailTitle}
  {emailTemplateFields}
  {selectedLanguage}
  {selectedRespondent}
  {campaign}
  {respondentFields}
/>

<div class="email-template-section">
  <!-- Email Title -->
  <div class="form-group">
    <div class="title-header">
      <label for="email-title">Email Subject *</label>
      <select
        class="placeholder-select-inline"
        on:change={(e) => {
          insertPlaceholder(e.target.value, "title");
          e.target.value = "";
        }}
      >
        <option value="">+ Insert Placeholder</option>
        {#each availablePlaceholders.filter((p) => p.category === "System") as placeholder}
          <option value={placeholder.value}>{placeholder.label}</option>
        {/each}
        {#if availablePlaceholders.filter((p) => p.category === "Respondent").length > 0}
          <optgroup label="Respondent">
            {#each availablePlaceholders.filter((p) => p.category === "Respondent") as placeholder}
              <option value={placeholder.value}>{placeholder.label}</option>
            {/each}
          </optgroup>
        {/if}
        {#if availablePlaceholders.filter((p) => p.category === "Custom").length > 0}
          <optgroup label="Custom">
            {#each availablePlaceholders.filter((p) => p.category === "Custom") as placeholder}
              <option value={placeholder.value}>{placeholder.label}</option>
            {/each}
          </optgroup>
        {/if}
      </select>
    </div>
    <input
      id="email-title"
      type="text"
      bind:this={emailTitleInput}
      bind:value={emailTitle}
      on:input={updateTemplate}
      placeholder="Enter email subject line"
      required
    />
  </div>

  <!-- Email Body Controls -->
  <div class="section-header">
    <h3>Email Body (HTML)</h3>
    <div class="editor-controls">
      <div class="placeholder-controls">
        <label for="placeholder-select">Insert Placeholder:</label>
        <select
          id="placeholder-select"
          on:change={(e) => {
            insertPlaceholder(e.target.value, "body");
            e.target.value = "";
          }}
        >
          <option value="">-- Select placeholder --</option>
          {#each availablePlaceholders.filter((p) => p.category === "System") as placeholder}
            <option value={placeholder.value}>
              {placeholder.label} ({placeholder.category})
            </option>
          {/each}
          {#if availablePlaceholders.filter((p) => p.category === "Respondent").length > 0}
            <optgroup label="Respondent Attributes">
              {#each availablePlaceholders.filter((p) => p.category === "Respondent") as placeholder}
                <option value={placeholder.value}>
                  {placeholder.label}
                </option>
              {/each}
            </optgroup>
          {/if}
          {#if availablePlaceholders.filter((p) => p.category === "Custom").length > 0}
            <optgroup label="Custom Fields">
              {#each availablePlaceholders.filter((p) => p.category === "Custom") as placeholder}
                <option value={placeholder.value}>
                  {placeholder.label}
                </option>
              {/each}
            </optgroup>
          {/if}
        </select>
      </div>

      <div class="control-group">
        <label for="language-select">Language:</label>
        <select
          id="language-select"
          bind:value={selectedLanguage}
          class="control-select"
        >
          {#each languages as lang}
            <option value={lang}>{lang.toUpperCase()}</option>
          {/each}
        </select>
      </div>

      <div class="control-group">
        <label for="respondent-select">Preview Respondent:</label>
        <select
          id="respondent-select"
          bind:value={selectedRespondentEmail}
          class="control-select"
        >
          <option value="">-- Select respondent --</option>
          {#each respondents as respondent}
            <option value={respondent.email}>
              {respondent.email || respondent.name || "Unnamed"}
            </option>
          {/each}
        </select>
      </div>

      <button
        type="button"
        class="btn-preview"
        on:click={handlePreview}
        disabled={!emailTemplate}
      >
        👁️ Preview Email
      </button>
    </div>
  </div>

  <!-- Monaco Editor -->
  <div class="email-editor-wrapper">
    <div
      bind:this={monacoContainer}
      class="monaco-editor"
      style="width: 100%; height: 500px;"
    ></div>
    {#if editorsLoading}
      <div class="editors-loading-overlay">
        <Spinner size="md" />
        <p>Loading editor...</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .email-template-section {
    width: calc(100% + 4rem);
    margin-left: -2rem;
    margin-right: -2rem;
    padding: 2rem;
    background: #f9f9f9;
    border-top: 1px solid var(--color-border);
    border-bottom: 1px solid var(--color-border);
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .title-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .title-header label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #333;
  }

  .placeholder-select-inline {
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-size: 0.75rem;
    background: white;
    cursor: pointer;
  }

  .form-group input[type="text"] {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-size: 0.95rem;
  }

  .form-group input[type="text"]:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .section-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #333;
  }

  .editor-controls {
    display: flex;
    gap: 1rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .placeholder-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
  }

  .placeholder-controls label {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .placeholder-controls select {
    padding: 0.5rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-size: 0.875rem;
    min-width: 200px;
  }

  .control-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .control-group label {
    font-size: 0.875rem;
    font-weight: 500;
    white-space: nowrap;
  }

  .control-select {
    padding: 0.5rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-size: 0.875rem;
    min-width: 150px;
  }

  .btn-preview {
    padding: 0.5rem 1rem;
    border: 1px solid var(--color-primary);
    background: white;
    color: var(--color-primary);
    border-radius: 4px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .btn-preview:hover:not(:disabled) {
    background: var(--color-primary);
    color: white;
  }

  .btn-preview:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .email-editor-wrapper {
    position: relative;
    background: white;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    min-height: 500px;
  }

  .editors-loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.9);
    z-index: 10;
  }

  .monaco-editor {
    min-height: 500px;
    height: 500px;
  }

  .editors-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 500px;
    gap: 1rem;
  }
</style>

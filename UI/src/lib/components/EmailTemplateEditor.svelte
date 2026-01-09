<script>
  import { onMount, tick } from "svelte";
  import { browser } from "$app/environment";
  import { createEventDispatcher } from "svelte";
  import Spinner from "./Spinner.svelte";
  import EmailPreviewModal from "./EmailPreviewModal.svelte";

  const dispatch = createEventDispatcher();

  export let emailTemplate = "";
  export let availablePlaceholders = [];
  export let editorsLoading = false;
  export let emailTemplateFields = [];
  export let respondents = [];
  export let languages = ["en", "cs", "de"]; // Available languages from form
  export let campaign = {};

  let quillEditor;
  let quillContainer;
  let monacoEditor;
  let monacoContainer;
  let editorMode = "wysiwyg";
  let isUpdatingEditor = false;
  let loader;
  let selectedLanguage = "en";
  let selectedRespondentEmail = "";
  let showPreview = false;

  $: selectedRespondent = respondents.find(r => r.email === selectedRespondentEmail) || null;

  if (browser) {
    import("@monaco-editor/loader").then((mod) => {
      loader = mod.default;
    });
  }

  // Sync editors when switching modes
  $: if (editorMode === "html" && monacoEditor && quillEditor && !isUpdatingEditor) {
    isUpdatingEditor = true;
    const html = quillEditor.root.innerHTML;
    monacoEditor.setValue(html);
    monacoEditor.layout();
    isUpdatingEditor = false;
  } else if (editorMode === "wysiwyg" && quillEditor && monacoEditor && !isUpdatingEditor) {
    isUpdatingEditor = true;
    const html = monacoEditor.getValue();
    quillEditor.root.innerHTML = html;
    isUpdatingEditor = false;
  }

  export async function initializeEditors() {
    if (typeof window === "undefined") return;

    editorsLoading = true;
    await tick();

    try {
      // Import Quill
      await import("quill/dist/quill.snow.css");
      const QuillModule = await import("quill");
      window.Quill = QuillModule.default;

      // Load Monaco
      if (!loader) {
        const loaderModule = await import("@monaco-editor/loader");
        loader = loaderModule.default;
      }
      const monaco = await loader.init();
      window.monaco = monaco;

      await tick();

      // Initialize Quill
      if (quillContainer && !quillEditor && window.Quill) {
        quillEditor = new window.Quill(quillContainer, {
          theme: "snow",
          readOnly: false,
          modules: {
            toolbar: [
              ["bold", "italic", "underline"],
              ["link"],
              [{ list: "ordered" }, { list: "bullet" }],
              [{ header: [1, 2, 3, false] }],
              ["clean"],
            ],
          },
        });

        if (emailTemplate) {
          let htmlContent = emailTemplate;
          availablePlaceholders.forEach((ph) => {
            const regex = new RegExp(
              ph.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
              "g"
            );
            htmlContent = htmlContent.replace(
              regex,
              `<span class="placeholder-badge" contenteditable="false" data-placeholder="${ph.value}">${ph.label}</span>`
            );
          });
          quillEditor.root.innerHTML = htmlContent;
        }

        quillEditor.on("text-change", () => {
          if (!isUpdatingEditor) {
            emailTemplate = quillEditor.root.innerHTML;
            dispatch("change", { value: emailTemplate });
          }
        });
      }

      // Initialize Monaco
      if (monacoContainer && !monacoEditor && window.monaco) {
        monacoEditor = window.monaco.editor.create(monacoContainer, {
          value: emailTemplate || "",
          language: "html",
          theme: "vs",
          minimap: { enabled: false },
          lineNumbers: "on",
          readOnly: false,
          wordWrap: "on",
        });

        monacoEditor.onDidChangeModelContent(() => {
          if (!isUpdatingEditor) {
            emailTemplate = monacoEditor.getValue();
            dispatch("change", { value: emailTemplate });
          }
        });
      }
    } catch (error) {
      console.error("Failed to load editors:", error);
    } finally {
      editorsLoading = false;
    }
  }

  function insertPlaceholder(placeholder) {
    if (!placeholder) return;

    if (editorMode === "wysiwyg" && quillEditor) {
      const range = quillEditor.getSelection(true);
      quillEditor.insertText(range.index, placeholder);
      quillEditor.setSelection(range.index + placeholder.length);
      quillEditor.focus();
    } else if (editorMode === "html" && monacoEditor) {
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

  onMount(() => {
    return () => {
      if (monacoEditor) {
        monacoEditor.dispose();
      }
    };
  });
</script>

<EmailPreviewModal
  bind:show={showPreview}
  {emailTemplate}
  {emailTemplateFields}
  {selectedLanguage}
  {selectedRespondent}
  {campaign}
/>

<div class="email-template-section">
  <div class="section-header">
    <div class="editor-controls">
      <div class="placeholder-controls">
        <label for="placeholder-select">Insert Placeholder:</label>
        <select
          id="placeholder-select"
          on:change={(e) => {
            insertPlaceholder(e.target.value);
            e.target.value = "";
          }}
        >
          <option value="">-- Select placeholder --</option>
          {#each availablePlaceholders.filter(p => p.category === 'System') as placeholder}
            <option value={placeholder.value}>
              {placeholder.label} ({placeholder.category})
            </option>
          {/each}
          {#if availablePlaceholders.filter(p => p.category === 'Respondent').length > 0}
            <optgroup label="Respondent Attributes">
              {#each availablePlaceholders.filter(p => p.category === 'Respondent') as placeholder}
                <option value={placeholder.value}>
                  {placeholder.label}
                </option>
              {/each}
            </optgroup>
          {/if}
          {#if availablePlaceholders.filter(p => p.category === 'Custom').length > 0}
            <optgroup label="Custom Fields">
              {#each availablePlaceholders.filter(p => p.category === 'Custom') as placeholder}
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

      <div class="editor-mode-toggle">
        <button
          type="button"
          class:active={editorMode === "wysiwyg"}
          on:click={() => (editorMode = "wysiwyg")}
        >
          📝 WYSIWYG
        </button>
        <button
          type="button"
          class:active={editorMode === "html"}
          on:click={() => (editorMode = "html")}
        >
          &lt;/&gt; HTML
        </button>
      </div>
    </div>
  </div>

  <div class="email-editor-wrapper">
    {#if editorsLoading}
      <div class="editors-loading">
        <Spinner size="md" />
        <p>Loading editors...</p>
      </div>
    {:else}
      <div
        bind:this={quillContainer}
        class="quill-editor"
        style="display: {editorMode === 'wysiwyg' ? 'block' : 'none'}"
      ></div>
      <div
        bind:this={monacoContainer}
   

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
  }     class="monaco-editor"
        style="display: {editorMode === 'html' ? 'block' : 'none'}"
      ></div>
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

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .editor-controls {
    display: flex;
    gap: 1rem;
    align-items: center;
    flex-wrap: wrap;
    width: 100%;
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

  .editor-mode-toggle {
    display: flex;
    gap: 0;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    overflow: hidden;
  }

  .editor-mode-toggle button {
    padding: 0.5rem 1rem;
    border: none;
    background: white;
    color: #666;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s;
  }

  .editor-mode-toggle button:not(:last-child) {
    border-right: 1px solid var(--color-border);
  }

  .editor-mode-toggle button.active {
    background: var(--color-primary);
    color: white;
  }

  .editor-mode-toggle button:hover:not(.active) {
    background: #f5f5f5;
  }

  .email-editor-wrapper {
    background: white;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    min-height: 400px;
  }

  .quill-editor,
  .monaco-editor {
    min-height: 400px;
  }

  .editors-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    gap: 1rem;
  }
</style>

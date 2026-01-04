<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { browser } from "$app/environment";
  import { auth } from "$lib/auth.js";
  import {
    getForm,
    createForm,
    updateForm,
    createFormVersion,
  } from "$lib/api.js";
  import JsonEditor from "$lib/components/JsonEditor.svelte";
  import Spinner from "$lib/components/Spinner.svelte";
  import { translations_store, currentLanguage } from "$lib/i18n/index.js";
  import {
    SURVEYJS_VERSIONS,
    getLatestProductionVersion,
    FORM_LANGUAGES,
  } from "$lib/config/surveyjs.js";
  import { timeAgo, formatDateTime } from "$lib/utils/time.js";
  import { toast } from "$lib/toast.js";

  // Dynamic import for SurveyPreview (client-side only)
  let SurveyPreview;
  if (browser) {
    import("$lib/components/SurveyPreview.svelte").then((module) => {
      SurveyPreview = module.default;
    });
  }

  let editor;
  let form = {
    name: "",
    surveyjs_version: getLatestProductionVersion(),
    languages: ["cs"],
    data: "{}",
    version_description: "",
  };
  let versions = [];
  let selectedVersionId = null;
  let loading = true;
  let saving = false;
  let creatingVersion = false;
  let activeTab = "setup";
  let previewJson = {};
  let error = "";

  $: t = $translations_store;

  $: templateId = $page.params.id;
  $: isNewForm = templateId === "new";

  // Update preview when switching to preview tab
  $: if (activeTab === "preview" && !loading) {
    console.log("[FormEditor] Switched to preview tab, updating preview");
    updatePreview();
  }

  // Check auth
  $: if (!$auth) {
    goto("/login");
  }

  onMount(() => {
    if (!isNewForm) {
      loadForm();
    } else {
      loading = false;
      form.data = JSON.stringify(
        {
          title: "New Survey",
          pages: [
            {
              name: "page1",
              elements: [
                {
                  type: "text",
                  name: "question1",
                  title: "What is your name?",
                },
              ],
            },
          ],
        },
        null,
        2,
      );
    }
  });

  async function loadForm() {
    loading = true;
    error = "";
    try {
      const loadedForm = await getForm(templateId);
      form.name = loadedForm.name;
      form.form_id = loadedForm.form_id;
      form.created = loadedForm.created;
      form.last_update = loadedForm.last_update;

      // Load versions
      versions = loadedForm.versions || [];

      // Select latest version by default (first in array)
      if (versions.length > 0) {
        selectedVersionId = versions[0].version_id;
        loadVersion(versions[0]);
      }
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function loadVersion(version) {
    form.surveyjs_version = version.surveyjs_version;
    form.languages = version.languages || [];
    form.data = JSON.stringify(version.data, null, 2);
    form.version_description = version.version_description || "";
    // Update preview only if we're on the preview tab
    if (activeTab === "preview") {
      updatePreview();
    }
  }

  function updatePreview() {
    console.log("[FormEditor] updatePreview called");
    try {
      const jsonString = editor ? editor.getValue() : form.data;
      console.log("[FormEditor] JSON string length:", jsonString?.length);

      if (!jsonString || jsonString.trim() === "") {
        console.warn("[FormEditor] Empty JSON string");
        previewJson = { title: "Empty survey", pages: [] };
        return;
      }

      const parsed = JSON.parse(jsonString);
      console.log("[FormEditor] Parsed JSON:", parsed);

      // Ensure it has the basic structure
      if (!parsed.pages || !Array.isArray(parsed.pages)) {
        console.warn("[FormEditor] Invalid structure, missing pages array");
        previewJson = { title: parsed.title || "Survey", pages: [] };
      } else {
        console.log(
          "[FormEditor] ✅ Valid survey JSON, pages:",
          parsed.pages.length,
        );
        previewJson = parsed;
      }

      console.log("[FormEditor] previewJson updated:", previewJson);
    } catch (err) {
      console.error("[FormEditor] ❌ Failed to parse JSON for preview:", err);
      previewJson = { title: "Invalid JSON", pages: [] };
    }
  }

  // Update preview when editor content changes (debounced)
  let updateTimer;
  $: if (form.data && activeTab === "preview") {
    console.log("[FormEditor] Form data changed, scheduling preview update");
    clearTimeout(updateTimer);
    updateTimer = setTimeout(() => {
      console.log("[FormEditor] Debounced update triggered");
      updatePreview();
    }, 300);
  }

  function handleVersionChange() {
    const version = versions.find((v) => v.version_id === selectedVersionId);
    if (version) {
      loadVersion(version);
    }
  }

  async function handleSave() {
    error = "";
    saving = true;

    try {
      // Validate JSON
      const data = editor.getJson();

      const payload = {
        name: form.name.trim(),
        surveyjs_version: form.surveyjs_version.trim(),
        languages: form.languages,
        data,
        version_description: form.version_description?.trim() || undefined,
      };

      if (isNewForm) {
        const created = await createForm(payload);
        toast.success("Form created successfully!");
        goto(`/admin/forms/${created.data.form_id}`);
      } else {
        await updateForm(templateId, payload);
        await loadForm();
        toast.success("Form updated successfully!");
      }
    } catch (err) {
      error = err.message;
    } finally {
      saving = false;
    }
  }

  async function handleCreateNewVersion() {
    error = "";
    creatingVersion = true;

    try {
      // Get current data
      const data = editor.getJson();

      // Find the highest version number
      const maxVersion = Math.max(...versions.map((v) => v.version));
      const newVersionNumber = maxVersion + 1;

      // Create new version
      const payload = {
        form_id: templateId,
        surveyjs_version: form.surveyjs_version.trim(),
        languages: form.languages,
        data,
        version_description: `Version ${newVersionNumber}`,
      };

      const result = await createFormVersion(payload);

      toast.success(`Version ${newVersionNumber} created successfully!`);

      // Reload form to get updated versions list
      await loadForm();

      // Select the newly created version
      selectedVersionId = result.data.version_id;
      const newVersion = versions.find(
        (v) => v.version_id === result.data.version_id,
      );
      if (newVersion) {
        loadVersion(newVersion);
      }
    } catch (err) {
      error = err.message;
      toast.error(err.message);
    } finally {
      creatingVersion = false;
    }
  }

  function formatJson() {
    if (editor) {
      editor.format();
    }
  }
</script>

<svelte:head>
  <title>{isNewForm ? "New Form" : form.name || "Edit Form"} - Evalytics</title>
</svelte:head>

<div class="page-header">
  <div>
    <a href="/admin/forms" class="back-link">← {t("forms.title")}</a>
    <h1>{isNewForm ? t("forms.new") : t("forms.edit")}</h1>
  </div>
  <div class="header-actions">
    {#if !isNewForm}
      <button
        on:click={handleCreateNewVersion}
        class="btn-secondary"
        disabled={creatingVersion || loading || saving}
        title="Create a new version based on current content"
      >
        {#if creatingVersion}
          <span
            class="spinner-small"
            style="border-top-color: var(--color-primary);"
          ></span>
        {/if}
        {creatingVersion ? "Creating..." : "Create New Version"}
      </button>
      <a href="/admin/campaigns/new?form_id={templateId}" class="btn-secondary"
        >{t("forms.createCampaign")}</a
      >
    {/if}
    <button
      on:click={handleSave}
      class="btn-primary"
      disabled={saving || loading}
    >
      {#if saving}
        <span class="spinner-small"></span>
      {/if}
      {saving
        ? t("common.saving")
        : isNewForm
          ? t("common.create")
          : t("forms.saveChanges")}
    </button>
  </div>
</div>

{#if loading}
  <Spinner centered size="lg">Loading template...</Spinner>
{:else}
  {#if error}
    <div class="error-message">{error}</div>
  {/if}

  <!-- Tabs Navigation -->
  <div class="tabs-nav">
    <button
      class="tab-button"
      class:active={activeTab === "setup"}
      on:click={() => (activeTab = "setup")}
    >
      ⚙️ Setup
    </button>
    <button
      class="tab-button"
      class:active={activeTab === "preview"}
      on:click={() => (activeTab = "preview")}
    >
      📋 Preview
    </button>
  </div>

  <!-- Setup Tab -->
  {#if activeTab === "setup"}
    <div class="editor-layout">
      <div class="form-section">
        <h2>{t("forms.name")}</h2>

        <div class="form-group">
          <label for="name">{t("forms.name")} *</label>
          <input
            id="name"
            type="text"
            bind:value={form.name}
            required
            placeholder={t("forms.name")}
          />
        </div>

        {#if !isNewForm && versions.length > 0}
          <div class="form-group">
            <label for="form-version"
              >Form Version ({versions.length} total)</label
            >
            <select
              id="form-version"
              bind:value={selectedVersionId}
              on:change={handleVersionChange}
            >
              {#each versions as version}
                <option value={version.version_id}>
                  v{version.version} - {new Date(
                    version.created,
                  ).toLocaleDateString($currentLanguage)}
                  {version.version === versions[0].version ? " (Latest)" : ""}
                </option>
              {/each}
            </select>
            <small class="hint"
              >Viewing version {versions.find(
                (v) => v.version_id === selectedVersionId,
              )?.version || "?"}</small
            >
          </div>
        {/if}

        <div class="form-group">
          <label for="surveyjs-version">SurveyJS Version *</label>
          <select
            id="surveyjs-version"
            bind:value={form.surveyjs_version}
            required
          >
            {#each SURVEYJS_VERSIONS as version}
              <option value={version.value}>{version.label}</option>
            {/each}
          </select>
        </div>

        <div class="form-group">
          <label for="languages">{t("forms.languages")} *</label>
          <select
            id="languages"
            bind:value={form.languages}
            multiple
            size="3"
            required
          >
            {#each FORM_LANGUAGES as lang}
              <option
                value={lang.code}
                selected={form.languages.includes(lang.code)}
              >
                {lang.flag}
                {lang.name}
              </option>
            {/each}
          </select>
          <small class="hint"
            >Hold Ctrl (Cmd) to select multiple languages</small
          >
        </div>

        <div class="form-group">
          <label for="version-desc">Version Description</label>
          <textarea
            id="version-desc"
            bind:value={form.version_description}
            rows="2"
            placeholder="Describe what changed in this version..."
          ></textarea>
          <small class="hint">Optional note about changes in this version</small
          >
        </div>

        {#if !isNewForm && form.form_id}
          <div class="info-section">
            <h3>{t("forms.info")}</h3>
            <dl>
              <dt>ID:</dt>
              <dd><code>{form.form_id}</code></dd>
              <dt>{t("forms.created")}:</dt>
              <dd>{new Date(form.created).toLocaleString($currentLanguage)}</dd>
              <dt>{t("forms.lastUpdate")}:</dt>
              <dd>
                {new Date(form.last_update).toLocaleString($currentLanguage)}
              </dd>
            </dl>
          </div>
        {/if}
      </div>

      <div class="json-section">
        <div class="section-header">
          <h2>{t("forms.definition")}</h2>
          <button type="button" on:click={formatJson} class="btn-small"
            >{t("forms.formatJson")}</button
          >
        </div>

        <JsonEditor
          bind:this={editor}
          bind:value={form.data}
          height="600px"
          on:change={updatePreview}
        />

        <div class="json-help">
          <p><strong>SurveyJS JSON Schema:</strong></p>
          <ul>
            <li><code>title</code> - Survey title</li>
            <li>
              <code>pages</code> - Array of pages, each with
              <code>elements</code>
              (questions)
            </li>
            <li>
              Question types: <code>text</code>, <code>checkbox</code>,
              <code>radiogroup</code>,
              <code>dropdown</code>, <code>comment</code>, <code>rating</code>,
              etc.
            </li>
            <li>
              Docs: <a
                href="https://surveyjs.io/form-library/documentation/design-survey/create-a-simple-survey"
                target="_blank">SurveyJS Documentation</a
              >
            </li>
          </ul>
        </div>
      </div>
    </div>
  {/if}

  <!-- Preview Tab -->
  {#if activeTab === "preview"}
    <div class="preview-tab-container">
      {#if browser && SurveyPreview}
        <svelte:component
          this={SurveyPreview}
          surveyJson={previewJson}
          surveyJsVersion={form.surveyjs_version}
        />
      {:else}
        <div style="padding: 2rem; text-align: center; color: #666;">
          Loading preview...
        </div>
      {/if}
    </div>
  {/if}
{/if}

<style>
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 24px;
    gap: 16px;
  }

  .back-link {
    display: inline-block;
    color: #666;
    text-decoration: none;
    margin-bottom: 8px;
    font-size: 14px;
  }

  .back-link:hover {
    color: #333;
  }

  h1 {
    margin: 0;
    font-size: 28px;
  }

  .header-actions {
    display: flex;
    gap: 12px;
  }

  .loading {
    text-align: center;
    padding: 40px;
    color: #666;
  }

  .error-message {
    padding: 16px;
    margin-bottom: 24px;
    background-color: #fee;
    border: 1px solid #fcc;
    border-radius: 4px;
    color: #c33;
  }

  .tabs-nav {
    display: flex;
    gap: 8px;
    margin-bottom: 24px;
    border-bottom: 2px solid #e5e5e5;
  }

  .tab-button {
    padding: 12px 24px;
    background: transparent;
    border: none;
    border-bottom: 3px solid transparent;
    cursor: pointer;
    font-size: 15px;
    font-weight: 500;
    color: #666;
    transition: all 0.2s;
    margin-bottom: -2px;
  }

  .tab-button:hover {
    color: #333;
    background: #f9f9f9;
  }

  .tab-button.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
  }

  .editor-layout {
    display: grid;
    grid-template-columns: 350px 1fr;
    gap: 24px;
    align-items: start;
  }

  .preview-tab-container {
    background: white;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    padding: 24px;
    min-height: 600px;
  }

  .form-section,
  .json-section {
    background: white;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    padding: 24px;
  }

  h2 {
    margin: 0 0 20px 0;
    font-size: 18px;
    font-weight: 600;
  }

  h3 {
    margin: 24px 0 12px 0;
    font-size: 16px;
    font-weight: 600;
  }

  .form-group {
    margin-bottom: 20px;
  }

  label {
    display: block;
    margin-bottom: 6px;
    font-weight: 500;
    font-size: 14px;
  }

  input,
  textarea {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    font-family: inherit;
    box-sizing: border-box;
  }

  textarea {
    resize: vertical;
    min-height: 60px;
  }

  input:focus,
  select:focus,
  textarea:focus {
    outline: none;
    border-color: #4a90e2;
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
  }

  select {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    font-family: inherit;
    box-sizing: border-box;
    background-color: white;
    cursor: pointer;
  }

  select[multiple] {
    height: auto;
    cursor: default;
  }

  select option {
    padding: 6px;
  }

  .hint {
    display: block;
    margin-top: 4px;
    font-size: 12px;
    color: #666;
  }

  .spinner-small {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    margin-right: 8px;
    vertical-align: middle;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .languages-list {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }

  .language-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background-color: #e3f2fd;
    border: 1px solid #90caf9;
    border-radius: 4px;
    font-size: 14px;
  }

  .remove-lang {
    background: none;
    border: none;
    color: #666;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 0;
    margin: 0;
  }

  .remove-lang:hover {
    color: #d32f2f;
  }

  .info-section {
    margin-top: 24px;
    padding-top: 24px;
    border-top: 1px solid #e5e5e5;
  }

  dl {
    margin: 0;
    display: grid;
    grid-template-columns: 100px 1fr;
    gap: 8px 12px;
    font-size: 14px;
  }

  dt {
    font-weight: 500;
    color: #666;
  }

  dd {
    margin: 0;
  }

  code {
    font-family: "Consolas", "Monaco", monospace;
    font-size: 13px;
    background-color: #f5f5f5;
    padding: 2px 6px;
    border-radius: 3px;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .json-help {
    margin-top: 16px;
    padding: 16px;
    background-color: #f8f9fa;
    border-radius: 4px;
    font-size: 14px;
  }

  .json-help p {
    margin: 0 0 8px 0;
  }

  .json-help ul {
    margin: 0;
    padding-left: 20px;
  }

  .json-help li {
    margin-bottom: 4px;
  }

  .json-help a {
    color: #4a90e2;
  }

  .btn-primary {
    padding: 10px 20px;
    background-color: #4a90e2;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: #357abd;
  }

  .btn-primary:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }

  .btn-secondary {
    padding: 10px 20px;
    background-color: white;
    color: #333;
    text-decoration: none;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    display: inline-block;
  }

  .btn-secondary:hover {
    background-color: #f5f5f5;
  }

  .btn-small {
    padding: 6px 12px;
    font-size: 13px;
    background-color: white;
    color: #666;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
  }

  .btn-small:hover {
    background-color: #f5f5f5;
  }

  @media (max-width: 1024px) {
    .editor-layout {
      grid-template-columns: 1fr;
    }
  }
</style>

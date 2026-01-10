<script>
  import { createEventDispatcher } from "svelte";
  import Spinner from "./Spinner.svelte";
  import { apiRequest } from "$lib/api.js";
  import { toast } from "$lib/toast.js";

  const dispatch = createEventDispatcher();

  export let campaignId = "";
  export let isPublic = false;
  export let languages = ["en", "cs", "de"]; // Available languages from campaign

  let loading = true;
  let exporting = false;
  let stats = {
    total_respondents: 0,
    in_progress: 0,
    completed: 0,
    total_responses: 0,
  };

  // Export options
  let statusFilters = {
    in_progress: true,
    completed: true,
  };
  let includeQuestionText = false;
  let includeAnswerText = false;
  let selectedFormat = "json";
  let selectedLanguage = "en"; // Default export language

  // Show language selector when text export is enabled
  $: showLanguageSelector = includeQuestionText || includeAnswerText;

  // Set default language to first available language
  $: if (
    languages &&
    languages.length > 0 &&
    !languages.includes(selectedLanguage)
  ) {
    selectedLanguage = languages[0];
  }

  $: if (campaignId) {
    loadStats();
  }

  async function loadStats() {
    loading = true;
    try {
      const response = await apiRequest(
        `GET`,
        `/campaigns/${campaignId}/responses/stats`,
      );
      stats = response;
    } catch (error) {
      console.error("Failed to load response stats:", error);
      toast.error("Failed to load statistics");
    } finally {
      loading = false;
    }
  }

  async function handleExport() {
    if (!selectedFormat) {
      toast.error("Please select an export format");
      return;
    }

    // Build query parameters
    const params = new URLSearchParams();

    // Status filters
    const selectedStatuses = Object.entries(statusFilters)
      .filter(([_, enabled]) => enabled)
      .map(([status]) => status);

    if (selectedStatuses.length === 0) {
      toast.error("Please select at least one response status");
      return;
    }

    params.append("status", selectedStatuses.join(","));
    params.append("format", selectedFormat);

    if (includeQuestionText) {
      params.append("includeQuestionText", "true");
      params.append("language", selectedLanguage);
    }
    if (includeAnswerText) {
      params.append("includeAnswerText", "true");
      if (!includeQuestionText) {
        params.append("language", selectedLanguage);
      }
    }

    exporting = true;
    try {
      const response = await apiRequest(
        "GET",
        `/campaigns/${campaignId}/responses/export?${params.toString()}`,
      );

      if (selectedFormat === "json") {
        // Download as JSON file
        const blob = new Blob([JSON.stringify(response, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `campaign-${campaignId}-responses-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success(`Exported ${response.count} response(s) to JSON`);
      } else if (selectedFormat === "excel") {
        toast.info("Excel export coming soon");
      }
    } catch (error) {
      console.error("Export failed:", error);
      toast.error(error.message || "Export failed");
    } finally {
      exporting = false;
    }
  }
</script>

<div class="responses-section">
  {#if loading}
    <div class="loading-state">
      <Spinner />
      <p>Loading statistics...</p>
    </div>
  {:else}
    <!-- Statistics Summary -->
    <div class="stats-summary">
      <h3>Response Statistics</h3>
      <div class="stats-grid">
        {#if !isPublic}
          <div class="stat-card">
            <div class="stat-value">{stats.total_respondents}</div>
            <div class="stat-label">Registered Respondents</div>
          </div>
        {/if}
        <div class="stat-card">
          <div class="stat-value">{stats.in_progress}</div>
          <div class="stat-label">In Progress</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{stats.completed}</div>
          <div class="stat-label">Completed</div>
        </div>
        <div class="stat-card highlight">
          <div class="stat-value">{stats.total_responses}</div>
          <div class="stat-label">Total Responses</div>
        </div>
      </div>
    </div>

    <!-- Export Options -->
    <div class="export-section">
      <h3>Export Responses</h3>

      <!-- Status Filters -->
      <div class="option-group">
        <label class="group-label">
          Response Status
          <span
            class="help-icon"
            title="Select which response statuses to include in the export"
            >ℹ️</span
          >
        </label>
        <div class="checkbox-group">
          <label>
            <input type="checkbox" bind:checked={statusFilters.in_progress} />
            <span>In Progress</span>
          </label>
          <label>
            <input type="checkbox" bind:checked={statusFilters.completed} />
            <span>Completed</span>
          </label>
        </div>
      </div>

      <!-- Export Type Options -->
      <div class="option-group">
        <label class="group-label">
          Export Options
          <span
            class="help-icon"
            title="Include human-readable question and answer texts from the survey definition"
            >ℹ️</span
          >
        </label>
        <div class="checkbox-group">
          <label>
            <input type="checkbox" bind:checked={includeQuestionText} />
            <span>Include Question Text</span>
          </label>
          <label>
            <input type="checkbox" bind:checked={includeAnswerText} />
            <span>Include Answer Text (for choice questions)</span>
          </label>
        </div>

        <!-- Language Selection (shown when text export is enabled) -->
        {#if showLanguageSelector}
          <div class="language-select">
            <label for="export-language">Language:</label>
            <select id="export-language" bind:value={selectedLanguage}>
              {#each languages as lang}
                <option value={lang}>{lang.toUpperCase()}</option>
              {/each}
            </select>
          </div>
        {/if}
      </div>

      <!-- Format Selection -->
      <div class="option-group">
        <label class="group-label">
          Export Format
          <span
            class="help-icon"
            title="Select the output format for the exported data">ℹ️</span
          >
        </label>
        <div class="format-buttons">
          <button
            type="button"
            class="format-btn"
            class:active={selectedFormat === "json"}
            on:click={() => (selectedFormat = "json")}
          >
            📄 JSON
          </button>
          <button
            type="button"
            class="format-btn"
            class:disabled={true}
            disabled
            title="Excel export coming soon"
          >
            📊 Excel (Coming Soon)
          </button>
        </div>
      </div>

      <!-- Export Button -->
      <div class="export-actions">
        <button
          type="button"
          class="btn-export"
          on:click={handleExport}
          disabled={exporting || stats.total_responses === 0}
        >
          {#if exporting}
            <Spinner size="sm" />
            Exporting...
          {:else}
            ⬇️ Export Responses
          {/if}
        </button>

        {#if stats.total_responses === 0}
          <p class="no-responses-hint">No responses available to export</p>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .responses-section {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    gap: 1rem;
  }

  /* Statistics Summary */
  .stats-summary h3 {
    margin: 0 0 1rem 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #333;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .stat-card {
    background: #f8f9fa;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 1.5rem;
    text-align: center;
    transition: all 0.2s;
  }

  .stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .stat-card.highlight {
    background: #e3f2fd;
    border-color: #90caf9;
  }

  .stat-value {
    font-size: 2.5rem;
    font-weight: 700;
    color: #1976d2;
    margin-bottom: 0.5rem;
  }

  .stat-label {
    font-size: 0.875rem;
    color: #666;
    font-weight: 500;
  }

  /* Export Section */
  .export-section {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 1.5rem;
  }

  .export-section h3 {
    margin: 0 0 1.5rem 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #333;
  }

  .option-group {
    margin-bottom: 1.5rem;
  }

  .group-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    color: #333;
    margin-bottom: 0.75rem;
  }

  .checkbox-group {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .checkbox-group label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.9375rem;
  }

  .checkbox-group input[type="checkbox"] {
    width: auto;
    margin: 0;
    cursor: pointer;
  }

  .language-select {
    margin-top: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid #f0f0f0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .language-select label {
    font-size: 0.9375rem;
    color: #666;
    font-weight: 500;
  }

  .language-select select {
    padding: 0.5rem 0.75rem;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    font-size: 0.9375rem;
    cursor: pointer;
    background: white;
  }

  .language-select select:focus {
    outline: none;
    border-color: #1976d2;
    box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.1);
  }

  .format-buttons {
    display: flex;
    gap: 1rem;
  }

  .format-btn {
    padding: 0.75rem 1.5rem;
    border: 2px solid #e0e0e0;
    background: white;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9375rem;
    font-weight: 500;
    transition: all 0.2s;
  }

  .format-btn:hover:not(.disabled) {
    border-color: #1976d2;
    background: #f5f5f5;
  }

  .format-btn.active {
    border-color: #1976d2;
    background: #e3f2fd;
    color: #1976d2;
  }

  .format-btn.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .export-actions {
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e0e0e0;
  }

  .btn-export {
    padding: 0.875rem 2rem;
    background: #1976d2;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;
  }

  .btn-export:hover:not(:disabled) {
    background: #1565c0;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
  }

  .btn-export:disabled {
    background: #ccc;
    cursor: not-allowed;
    transform: none;
  }

  .no-responses-hint {
    margin-top: 1rem;
    color: #999;
    font-size: 0.875rem;
    font-style: italic;
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

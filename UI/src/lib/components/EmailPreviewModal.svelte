<script>
  import { createEventDispatcher } from "svelte";
  import Spinner from "./Spinner.svelte";

  const dispatch = createEventDispatcher();

  export let show = false;
  export let emailTemplate = "";
  export let emailTemplateFields = [];
  export let selectedLanguage = "en";
  export let selectedRespondent = null;
  export let campaign = {};

  let loading = false;
  let previewHtml = "";

  $: if (show && emailTemplate) {
    renderPreview();
  }

  function renderPreview() {
    loading = true;
    try {
      let html = emailTemplate;

      // Replace system placeholders
      html = html.replace(/__campaign_name__/g, campaign.name || "[Campaign Name]");
      html = html.replace(/__link__/g, getSurveyLink());
      
      // Replace respondent data
      if (selectedRespondent) {
        html = html.replace(/__email__/g, selectedRespondent.email || "[Email]");
        html = html.replace(/__name__/g, selectedRespondent.name || "[Name]");
        
        // Replace other respondent fields
        Object.keys(selectedRespondent).forEach((key) => {
          if (key !== "email" && key !== "token") {
            const placeholder = `__${key}__`;
            const value = selectedRespondent[key] || `[${key}]`;
            html = html.replace(new RegExp(placeholder, "g"), value);
          }
        });
      } else {
        html = html.replace(/__email__/g, "[Email]");
        html = html.replace(/__name__/g, "[Name]");
      }

      // Replace custom multilingual fields
      emailTemplateFields.forEach((field) => {
        const placeholder = `__${field.id}__`;
        const value = field[selectedLanguage] || field.en || field.name || `[${field.id}]`;
        html = html.replace(new RegExp(placeholder, "g"), value);
      });

      previewHtml = html;
    } catch (error) {
      console.error("Failed to render preview:", error);
      previewHtml = "<p style='color: red;'>Failed to render preview</p>";
    } finally {
      loading = false;
    }
  }

  function getSurveyLink() {
    if (!selectedRespondent || !selectedRespondent.token) {
      return "[Survey Link]";
    }
    const baseUrl = import.meta.env.VITE_SURVEY_BASE_URL || window.location.origin;
    return `${baseUrl}/survey/${campaign.public_id}?token=${selectedRespondent.token}`;
  }

  function handleClose() {
    show = false;
    dispatch("close");
  }

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-backdrop" on:click={handleBackdropClick}>
    <div class="modal-content">
      <div class="modal-header">
        <h2>Email Preview</h2>
        <button type="button" class="close-button" on:click={handleClose}>
          ×
        </button>
      </div>

      <div class="modal-body">
        {#if loading}
          <div class="preview-loading">
            <Spinner size="md" />
            <p>Rendering preview...</p>
          </div>
        {:else}
          <div class="preview-info">
            <div class="info-item">
              <strong>Language:</strong>
              <span>{selectedLanguage.toUpperCase()}</span>
            </div>
            {#if selectedRespondent}
              <div class="info-item">
                <strong>Respondent:</strong>
                <span>{selectedRespondent.email || selectedRespondent.name || "Unknown"}</span>
              </div>
            {/if}
          </div>

          <div class="preview-container">
            <div class="email-preview">
              {@html previewHtml}
            </div>
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button type="button" class="btn-secondary" on:click={handleClose}>
          Close
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
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 2rem;
  }

  .modal-content {
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    max-width: 900px;
    width: 100%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--color-border);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .close-button {
    background: none;
    border: none;
    font-size: 2rem;
    line-height: 1;
    cursor: pointer;
    color: #666;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .close-button:hover {
    background: #f5f5f5;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .preview-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    gap: 1rem;
  }

  .preview-info {
    display: flex;
    gap: 2rem;
    margin-bottom: 1rem;
    padding: 1rem;
    background: #f9f9f9;
    border-radius: 4px;
  }

  .info-item {
    display: flex;
    gap: 0.5rem;
  }

  .info-item strong {
    font-weight: 600;
  }

  .preview-container {
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: white;
    padding: 2rem;
    min-height: 400px;
  }

  .email-preview {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    color: #333;
  }

  .email-preview :global(h1),
  .email-preview :global(h2),
  .email-preview :global(h3) {
    margin-top: 1em;
    margin-bottom: 0.5em;
  }

  .email-preview :global(p) {
    margin-bottom: 1em;
  }

  .email-preview :global(a) {
    color: var(--color-primary);
    text-decoration: underline;
  }

  .email-preview :global(ul),
  .email-preview :global(ol) {
    margin-bottom: 1em;
    padding-left: 2em;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1.5rem;
    border-top: 1px solid var(--color-border);
  }

  .btn-secondary {
    padding: 0.75rem 1.5rem;
    border: 1px solid var(--color-border);
    background: white;
    color: #333;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s;
  }

  .btn-secondary:hover {
    background: #f5f5f5;
  }
</style>

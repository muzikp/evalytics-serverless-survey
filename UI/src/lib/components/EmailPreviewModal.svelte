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
  export let respondentFields = [];

  let loading = false;
  let previewHtml = "";
  let previewTitle = "";

  // Parse emailTemplate JSON
  let emailTitle = "";
  let emailBody = "";

  $: {
    if (emailTemplate) {
      try {
        const parsed = JSON.parse(emailTemplate);
        emailTitle = parsed.title || "";
        emailBody = parsed.body || "";
      } catch (err) {
        // Legacy format - plain HTML
        emailBody = emailTemplate;
        emailTitle = "";
      }
    }
  }

  $: if (show && (emailBody || emailTitle)) {
    renderPreview();
  }

  function renderPreview() {
    loading = true;
    try {
      console.log("Rendering email preview with:");
      console.log("  emailTemplateFields:", emailTemplateFields);
      console.log("  respondentFields:", respondentFields);
      console.log("  selectedRespondent:", selectedRespondent);
      console.log("  selectedLanguage:", selectedLanguage);

      // Process both title and body
      let html = emailBody;
      let title = emailTitle;

      // Function to replace placeholders in text
      const replacePlaceholders = (text) => {
        if (!text) return text;

        let result = text;

        // Replace system placeholders
        result = result.replace(
          /__campaign_name__/g,
          campaign.name || "[Campaign Name]",
        );
        result = result.replace(/__link__/g, getSurveyLink());

        // Replace respondent data
        if (selectedRespondent) {
          result = result.replace(
            /__email__/g,
            selectedRespondent.email || "[Email]",
          );
          result = result.replace(
            /__name__/g,
            selectedRespondent.name || "[Name]",
          );

          // Replace respondent fields using field definitions
          if (respondentFields && respondentFields.length > 0) {
            console.log("Replacing respondent field placeholders...");
            respondentFields.forEach((field) => {
              const dataKey = field.dataKey || field.id;
              const placeholder = `__${field.id}__`; // Use field ID (field_ra_...) for placeholder
              let value = selectedRespondent[dataKey]; // But access data using dataKey

              console.log(
                `  ${placeholder} -> ${dataKey} = ${JSON.stringify(value)}`,
              );

              // Handle dictionary values (multilingual)
              if (value && typeof value === "object" && !Array.isArray(value)) {
                value =
                  value[selectedLanguage] ||
                  value.en ||
                  value.cs ||
                  JSON.stringify(value);
              }

              result = result.replace(
                new RegExp(placeholder, "g"),
                value || `[${field.label || field.id}]`,
              );
            });
          }
        } else {
          result = result.replace(/__email__/g, "[Email]");
          result = result.replace(/__name__/g, "[Name]");
        }

        // Replace custom multilingual fields
        console.log("Replacing email template fields...");
        emailTemplateFields.forEach((field) => {
          const placeholder = `__${field.id}__`;
          const value =
            field.value?.[selectedLanguage] ||
            field.value?.en ||
            field.name ||
            `[${field.id}]`;
          console.log(`  ${placeholder} = ${value}`);
          result = result.replace(new RegExp(placeholder, "g"), value);
        });

        return result;
      };

      previewTitle = replacePlaceholders(title);
      previewHtml = replacePlaceholders(html);
    } catch (error) {
      console.error("Failed to render preview:", error);
      previewHtml = "<p style='color: red;'>Failed to render preview</p>";
      previewTitle = "[Error]";
    } finally {
      loading = false;
    }
  }

  function getSurveyLink() {
    if (!selectedRespondent || !selectedRespondent.token) {
      return "[Survey Link]";
    }
    const baseUrl =
      import.meta.env.VITE_SURVEY_BASE_URL || window.location.origin;
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
                <span
                  >{selectedRespondent.email ||
                    selectedRespondent.name ||
                    "Unknown"}</span
                >
              </div>
            {/if}
          </div>

          <!-- Email Subject -->
          {#if previewTitle}
            <div class="email-subject">
              <strong>Subject:</strong>
              <span>{previewTitle}</span>
            </div>
          {/if}

          <!-- Email Body -->
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

  .email-subject {
    margin-bottom: 1rem;
    padding: 1rem;
    background: #f0f7ff;
    border: 1px solid #cce5ff;
    border-radius: 4px;
  }

  .email-subject strong {
    font-weight: 600;
    color: #0066cc;
    margin-right: 0.5rem;
  }

  .email-subject span {
    font-size: 1.1rem;
    color: #333;
  }

  .preview-container {
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: white;
    padding: 2rem;
    min-height: 400px;
  }

  .email-preview {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      sans-serif;
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

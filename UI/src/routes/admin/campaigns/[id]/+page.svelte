<script>
  import { onMount, tick } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { browser } from "$app/environment";
  import { auth } from "$lib/auth.js";
  import {
    getForms,
    getForm,
    createCampaign,
    getCampaign,
    updateCampaign,
    getCampaignRespondents,
  } from "$lib/api.js";
  import Spinner from "$lib/components/Spinner.svelte";
  import ConfigureRespondentFieldsDialog from "$lib/components/ConfigureRespondentFieldsDialog.svelte";
  import AccordionSection from "$lib/components/AccordionSection.svelte";
  import { translations_store } from "$lib/i18n/index.js";
  import { toast } from "$lib/toast.js";

  // Quill, Monaco and their loaders will be imported dynamically in browser only
  let loader;
  if (browser) {
    import("@monaco-editor/loader").then((mod) => {
      loader = mod.default;
    });
  }

  // Quill editor
  let quillEditor;
  let quillContainer;

  // Monaco editor
  let monacoEditor;
  let monacoContainer;
  let editorMode = "wysiwyg"; // 'wysiwyg' or 'html'
  let isUpdatingEditor = false; // Prevent circular updates

  $: t = $translations_store;
  $: campaignId = $page.params.id;
  $: isNewCampaign = campaignId === "new";
  $: pageTitle = isNewCampaign ? "Create Campaign" : "Edit Campaign";

  let campaign = {
    name: "",
    public_id: "",
    description: "",
    form_id: "",
    version_id: "",
    start_date: "",
    end_date: "",
    is_public: false,
    allow_retries: true,
    response_persistence: true,
    can_edit_after_submit: false,
    can_reopen_after_submit: true,
    email_template: "",
  };

  let forms = [];
  let formVersions = [];
  let respondents = [];
  let respondentFields = [];
  let emailTemplateFields = []; // Custom placeholders with multilingual values
  let loading = true;
  let saving = false;
  let importing = false;
  let showConfigureDialog = false;
  let error = "";
  let generatedCampaignId = ""; // For new campaigns
  let autoGenerateToken = true;
  let editorsLoading = false;
  let respondentsLoading = false;
  
  // Accordion state
  let accordionOpen = {
    general: true,
    respondents: false,
    email: false
  };

  // Reactive: sync editors when switching modes
  $: if (
    editorMode === "html" &&
    monacoEditor &&
    quillEditor &&
    !isUpdatingEditor
  ) {
    // Switching to HTML mode - update Monaco with Quill content
    isUpdatingEditor = true;
    const html = quillEditor.root.innerHTML;
    monacoEditor.setValue(html);
    monacoEditor.layout(); // Force Monaco to recalculate layout
    isUpdatingEditor = false;
  } else if (
    editorMode === "wysiwyg" &&
    quillEditor &&
    monacoEditor &&
    !isUpdatingEditor
  ) {
    // Switching to WYSIWYG mode - update Quill with Monaco content
    isUpdatingEditor = true;
    const html = monacoEditor.getValue();
    quillEditor.root.innerHTML = html;
    isUpdatingEditor = false;
  }

  // Available placeholders for email template - reactive to respondentFields and emailTemplateFields
  $: availablePlaceholders = [
    { value: "__link__", label: "Survey Link", category: "System" },
    { value: "__email__", label: "Email", category: "System" },
    { value: "__name__", label: "Name", category: "System" },
    { value: "__campaign_name__", label: "Campaign Name", category: "System" },
    ...(respondentFields || [])
      .filter((f) => f.name !== "email" && f.name !== "token")
      .map((f) => ({
        value: `__${f.name}__`,
        label: f.label || f.name,
        category: "Respondent"
      })),
    ...(emailTemplateFields || [])
      .map((f) => ({
        value: `__${f.id}__`,
        label: f.id,
        category: "Custom"
      }))
  ];

  // Check auth
  $: if (browser && !$auth) {
    goto("/login");
  }

  // Pre-select form if form_id in query params
  $: formIdParam = $page.url.searchParams.get("form_id");

  // Load versions when form is selected
  $: if (campaign.form_id) {
    loadFormVersions(campaign.form_id);
  }

  onMount(async () => {
    if (isNewCampaign) {
      generatedCampaignId = generateCampaignId();
      await loadForms();
      if (formIdParam) {
        campaign.form_id = formIdParam;
      }
      loading = false;

      // Initialize editors for new non-public campaigns
      if (!campaign.is_public) {
        await loadEditors();
      }
    } else {
      // Load forms FIRST, then campaign (campaign needs forms to find form_id)
      await loadForms();
      await loadCampaign();

      // Initialize editors after campaign is loaded
      if (!campaign.is_public) {
        await loadEditors();
      }
    }
  });

  async function loadEditors() {
    if (typeof window === "undefined") return;

    editorsLoading = true;

    // Wait for Svelte to render the containers
    await tick();

    try {
      // Dynamically import Quill CSS and module (browser only)
      await import("quill/dist/quill.snow.css");
      const QuillModule = await import("quill");
      window.Quill = QuillModule.default;

      // Load Monaco using @monaco-editor/loader (dynamically imported)
      if (!loader) {
        const loaderModule = await import("@monaco-editor/loader");
        loader = loaderModule.default;
      }
      const monaco = await loader.init();
      window.monaco = monaco;

      initializeEditors();
    } catch (error) {
      console.error("Failed to load editors:", error);
      toast.error("Failed to load editors");
    } finally {
      editorsLoading = false;
    }
  }

  function initializeEditors() {
    // Wait a tick to ensure DOM is ready
    tick().then(() => {
      console.log("Initializing editors...", {
        quillContainer: !!quillContainer,
        monacoContainer: !!monacoContainer,
        email_template: campaign.email_template?.substring(0, 50),
        is_public: campaign.is_public,
      });

      // Initialize Quill
      if (quillContainer && !quillEditor && window.Quill) {
        try {
          quillEditor = new window.Quill(quillContainer, {
            theme: "snow",
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

          console.log("Quill initialized successfully");

          // Set initial content - convert __placeholder__ to badges
          if (campaign.email_template) {
            let htmlContent = campaign.email_template;

            // Convert __placeholder__ format to visual badges
            availablePlaceholders.forEach((ph) => {
              const regex = new RegExp(
                ph.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                "g",
              );
              htmlContent = htmlContent.replace(
                regex,
                `<span class="placeholder-badge" contenteditable="false" data-placeholder="${ph.value}">${ph.label}</span>`,
              );
            });

            quillEditor.root.innerHTML = htmlContent;
            console.log(
              "Quill content set with placeholders converted to badges",
            );
          }

          // Update campaign.email_template on Quill change
          quillEditor.on("text-change", () => {
            if (!isUpdatingEditor) {
              campaign.email_template = quillEditor.root.innerHTML;
            }
          });
        } catch (error) {
          console.error("Failed to initialize Quill:", error);
          toast.error("Failed to initialize rich text editor");
        }
      }

      // Initialize Monaco
      if (monacoContainer && !monacoEditor && window.monaco) {
        monacoEditor = window.monaco.editor.create(monacoContainer, {
          value: campaign.email_template || "",
          language: "html",
          theme: "vs",
          minimap: { enabled: false },
          lineNumbers: "on",
          automaticLayout: true,
          wordWrap: "on",
        });

        console.log("Monaco initialized successfully");

        // Update campaign.email_template on Monaco change
        monacoEditor.onDidChangeModelContent(() => {
          if (!isUpdatingEditor) {
            campaign.email_template = monacoEditor.getValue();
          }
        });
      }
    });
  }

  function generateCampaignId() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let id = "";
    for (let i = 0; i < 16; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  function generateToken() {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let token = "";
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  async function loadCampaign() {
    loading = true;
    error = "";
    try {
      const data = await getCampaign(campaignId);
      console.log("Campaign data loaded:", data);

      // Extract title - can be string or object
      let title = data.title;
      if (typeof title === "object" && title) {
        title = title.en || title.cs || Object.values(title)[0] || "";
      }

      // Extract description
      let description = data.description || "";
      if (typeof description === "object" && description) {
        description =
          description.en ||
          description.cs ||
          Object.values(description)[0] ||
          "";
      }

      // Extract email template
      let emailTemplate = data.email_template || "";
      if (typeof emailTemplate === "object" && emailTemplate) {
        if (emailTemplate.invite && emailTemplate.invite.html) {
          emailTemplate = emailTemplate.invite.html;
        } else {
          emailTemplate = JSON.stringify(emailTemplate, null, 2);
        }
      }
      console.log("Email template from API:", emailTemplate?.substring(0, 100));

      campaign = {
        name: title,
        public_id: data.public_id || "",
        description: description,
        form_id: "", // Will be set from version_id lookup
        version_id: data.version_id,
        open_on: data.open_on ? data.open_on.split("T")[0] : "",
        close_on: data.close_on ? data.close_on.split("T")[0] : "",
        is_public: Boolean(data.is_public),
        allow_retries: Boolean(data.allow_retries),
        response_persistence:
          data.response_persistence !== undefined
            ? Boolean(data.response_persistence)
            : true,
        email_template: emailTemplate,
      };
      
      // Load email template fields
      if (data.email_template_fields) {
        emailTemplateFields = Array.isArray(data.email_template_fields) 
          ? data.email_template_fields 
          : [];
      }

      // Find form_id from versions
      if (data.version_id && forms.length > 0) {
        console.log(
          "Looking for form_id for version:",
          data.version_id,
          "in",
          forms.length,
          "forms",
        );
        for (const form of forms) {
          const formData = await getForm(form.form_id);
          const version = formData.versions?.find(
            (v) => v.version_id === data.version_id,
          );
          if (version) {
            campaign.form_id = form.form_id;
            console.log("Found form_id:", form.form_id);
            break;
          }
        }
        if (!campaign.form_id) {
          console.warn("Could not find form for version_id:", data.version_id);
        }
      } else {
        console.warn(
          "Cannot lookup form_id - version_id:",
          data.version_id,
          "forms:",
          forms.length,
        );
      }

      // Load respondents for private campaigns
      if (!campaign.is_public) {
        await loadRespondents();
      }
    } catch (err) {
      console.error("Error loading campaign:", err);
      error = err.message || String(err);
      toast.error(err.message || "Failed to load campaign");
    } finally {
      loading = false;
      console.log(
        "Campaign loaded, is_public:",
        campaign.is_public,
        "email_template length:",
        campaign.email_template?.length,
      );
    }
  }

  async function loadRespondents() {
    respondentsLoading = true;
    try {
      const response = await getCampaignRespondents(campaignId);
      const items = response.items || [];

      console.log("API response items:", items);

      if (items.length > 0) {
        // Extract respondents data
        respondents = items.map((item) => {
          const result = { 
            email: item.email,
            token: item.token  // Add token from API response
          };

          // Extract data from JSON field
          if (item.data && typeof item.data === "object") {
            console.log("Item data:", item.data);
            Object.assign(result, item.data);
          }

          console.log("Mapped result:", result);
          return result;
        });

        console.log("All respondents after mapping:", respondents);

        // Infer respondent fields from data
        const fieldSet = new Set();
        respondents.forEach((r) => {
          Object.keys(r).forEach((key) => fieldSet.add(key));
        });

        console.log("Field set:", Array.from(fieldSet));

        // Create field configuration (email and token are mandatory, others are custom)
        respondentFields = Array.from(fieldSet)
          .map((fieldName) => {
            if (fieldName === "email") {
              return {
                name: "email",
                label: "Email",
                type: "email",
                required: true,
                order: 0,
              };
            } else if (fieldName === "token") {
              return {
                name: "token",
                label: "Token",
                type: "text",
                required: false,
                order: 1,
              };
            } else {
              // Custom field - infer type from value
              const sampleValue = respondents.find((r) => r[fieldName])?.[
                fieldName
              ];
              return {
                name: fieldName,
                label: fieldName.charAt(0).toUpperCase() + fieldName.slice(1),
                type: typeof sampleValue === "number" ? "number" : "text",
                required: false,
                order: 10,
              };
            }
          })
          .sort((a, b) => a.order - b.order);

        console.log("Loaded respondents:", respondents.length);
        console.log("Inferred fields:", respondentFields);
      } else {
        // No respondents yet - set default fields
        respondentFields = [
          {
            name: "email",
            label: "Email",
            type: "email",
            required: true,
            order: 0,
          },
          {
            name: "token",
            label: "Token",
            type: "text",
            required: false,
            order: 1,
          },
        ];
        console.log("No respondents found - using default fields");
      }
    } catch (err) {
      console.error("Failed to load respondents:", err);
      // Set default fields even on error
      respondentFields = [
        {
          name: "email",
          label: "Email",
          type: "email",
          required: true,
          order: 0,
        },
        {
          name: "token",
          label: "Token",
          type: "text",
          required: false,
          order: 999,
        },
      ];
    } finally {
      respondentsLoading = false;
    }
  }

  function copySurveyLink(respondent) {
    const publicId = campaign.public_id || generatedCampaignId || campaignId;
    const token = respondent.token || "";
    const link = `${window.location.origin}/survey/${publicId}${token ? "?token=" + encodeURIComponent(token) : ""}`;

    navigator.clipboard
      .writeText(link)
      .then(() => {
        toast.success("Survey link copied to clipboard!");
      })
      .catch(() => {
        toast.error("Failed to copy link");
      });
  }

  async function loadForms() {
    try {
      const response = await getForms({});
      forms = response.forms || [];
      console.log("Forms loaded:", forms.length);
      if (forms.length === 0) {
        toast.warning("No forms available. Please create a form first.");
      }
    } catch (err) {
      console.error("Failed to load forms:", err);
      error = err.message;
      toast.error("Failed to load forms: " + err.message);
    }
  }

  async function loadFormVersions(formId) {
    if (!formId) {
      formVersions = [];
      campaign.version_id = "";
      return;
    }

    try {
      const response = await getForm(formId);
      formVersions = response.versions || [];

      // Auto-select if only one version
      if (formVersions.length === 1) {
        campaign.version_id = formVersions[0].version_id;
      } else if (formVersions.length > 0) {
        // Select latest version by default
        campaign.version_id = formVersions[0].version_id;
      }
    } catch (err) {
      console.error("Failed to load form versions:", err);
      formVersions = [];
    }
  }

  async function handleSave() {
    error = "";
    saving = true;

    try {
      // Validate
      if (!campaign.name.trim()) {
        throw new Error("Campaign name is required");
      }
      if (
        campaign.public_id &&
        campaign.public_id.trim() &&
        !/^[a-z0-9-]+$/.test(campaign.public_id)
      ) {
        throw new Error(
          "Public name must contain only lowercase letters, numbers, and hyphens",
        );
      }
      if (!campaign.form_id) {
        throw new Error("Please select a form");
      }
      if (!campaign.version_id) {
        throw new Error("Please select a form version");
      }
      if (
        campaign.start_date &&
        campaign.end_date &&
        new Date(campaign.end_date) <= new Date(campaign.start_date)
      ) {
        throw new Error("End date must be after start date");
      }
      if (!campaign.is_public && respondents.length === 0) {
        throw new Error("Private campaigns must have at least one respondent");
      }

      // Validate respondent data
      if (!campaign.is_public && respondentFields.length > 0) {
        for (let i = 0; i < respondents.length; i++) {
          const respondent = respondents[i];
          for (const field of respondentFields) {
            if (field.required && !respondent[field.name]) {
              throw new Error(`Row ${i + 1}: ${field.label} is required`);
            }
            if (
              respondent[field.name] &&
              !validateRespondentField(respondent[field.name], field)
            ) {
              throw new Error(`Row ${i + 1}: Invalid ${field.label}`);
            }
          }
        }
      }

      // Convert placeholder badges back to __placeholder__ format for storage
      let emailTemplateForSave = campaign.email_template || "";
      if (emailTemplateForSave) {
        // Replace <span class="placeholder-badge" data-placeholder="__X__">Label</span> with __X__
        emailTemplateForSave = emailTemplateForSave.replace(
          /<span[^>]*class="placeholder-badge"[^>]*data-placeholder="([^"]+)"[^>]*>[^<]*<\/span>/gi,
          "$1",
        );
      }

      // Prepare campaign data - backend expects title, not name
      const campaignData = {
        title: campaign.name,
        public_id: campaign.public_id || null,
        description: campaign.description || null,
        version_id: campaign.version_id,
        open_on: campaign.open_on || null,
        close_on: campaign.close_on || null,
        is_public: campaign.is_public ? 1 : 0,
        allow_retries: campaign.allow_retries ? 1 : 0,
        response_persistence: campaign.response_persistence ? 1 : 0,
        email_template: emailTemplateForSave,
        email_template_fields: emailTemplateFields.length > 0 ? emailTemplateFields : null,
      };

      if (isNewCampaign) {
        campaignData.campaign_id = generatedCampaignId;
        campaignData.respondents = respondents;
        await createCampaign(campaignData);
        toast.success("Campaign created successfully");
        goto("/admin/campaigns");
      } else {
        await updateCampaign(campaignId, campaignData);
        toast.success("Campaign updated successfully");
        // Don't reload page, just show success toast
      }
    } catch (err) {
      error = err.message;
      toast.error(err.message);
    } finally {
      saving = false;
    }
  }

  function handleCancel() {
    goto("/admin/campaigns");
  }

  function handleConfigureFields() {
    showConfigureDialog = true;
  }

  function handleSaveFieldConfiguration(event) {
    respondentFields = event.detail;
    showConfigureDialog = false;
    toast.success("Field configuration saved");
  }

  function handleImportRespondents() {
    if (respondentFields.length === 0) {
      toast.error("Please configure respondent fields first");
      return;
    }
    // TODO: Open import dialog
    toast.info("Import dialog will open here");
  }

  function handleAddRespondentRow() {
    if (respondentFields.length === 0) {
      toast.error("Please configure respondent fields first");
      return;
    }
    const newRespondent = {};
    respondentFields.forEach((field) => {
      if (field.name === "token" && autoGenerateToken) {
        newRespondent[field.name] = generateToken();
      } else {
        newRespondent[field.name] = "";
      }
    });
    respondents = [...respondents, newRespondent];
  }

  function removeRespondent(index) {
    respondents = respondents.filter((_, i) => i !== index);
    toast.success("Respondent removed");
  }

  function insertPlaceholder(placeholder) {
    if (!placeholder) return;

    // Find the label for this placeholder
    const placeholderObj = availablePlaceholders.find(
      (p) => p.value === placeholder,
    );
    const label = placeholderObj ? placeholderObj.label : placeholder;

    if (editorMode === "wysiwyg" && quillEditor) {
      const range = quillEditor.getSelection();
      const html = `<span class="placeholder-badge" contenteditable="false" data-placeholder="${placeholder}">${label}</span>&nbsp;`;

      if (range) {
        // Insert at cursor position using clipboard
        const delta = quillEditor.clipboard.convert({ html });
        quillEditor.updateContents(delta, "user");
        quillEditor.setSelection(range.index + 1);
      } else {
        const length = quillEditor.getLength();
        const delta = quillEditor.clipboard.convert({ html });
        quillEditor.updateContents(delta, "user");
      }
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

  function validateRespondentField(value, field) {
    if (field.required && !value) {
      return false;
    }
    if (!value) return true;

    switch (field.type) {
      case "email":
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case "number":
        return !isNaN(value);
      case "url":
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      case "tel":
        return /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/.test(
          value,
        );
      default:
        return true;
    }
  }
  
  // Accordion functions
  function toggleAccordion(section) {
    accordionOpen[section] = !accordionOpen[section];
  }
  
  // Email template field functions
  function addEmailTemplateField() {
    const newField = {
      id: `field_${Date.now()}`,
      cs: "",
      en: "",
      de: ""
    };
    emailTemplateFields = [...emailTemplateFields, newField];
  }
  
  function removeEmailTemplateField(index) {
    emailTemplateFields = emailTemplateFields.filter((_, i) => i !== index);
  }
  
  function generateFieldPlaceholder(fieldId) {
    return `__${fieldId}__`;
  }
  
  // Get survey URL with token
  function getSurveyUrl(token) {
    const baseUrl = import.meta.env.VITE_SURVEY_BASE_URL || window.location.origin;
    return `${baseUrl}/survey/${campaign.public_id}?token=${token}`;
  }
</script>


<svelte:head>
  <title>{pageTitle} - {t("app.name")}</title>
  <link
    href="https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css"
    rel="stylesheet"
  />
</svelte:head>

<div class="page-header">
  <div>
    <a href="/admin/campaigns" class="back-link">← Campaigns</a>
    <h1>{pageTitle}</h1>
  </div>
  <div class="actions">
    <button class="btn-secondary" on:click={handleCancel}>Cancel</button>
    <button
      class="btn-primary"
      on:click={handleSave}
      disabled={saving || loading}
    >
      {#if saving}
        <span class="spinner-small"></span>
      {/if}
      {saving ? "Saving..." : "Save Campaign"}
    </button>
  </div>
</div>

{#if loading}
  <Spinner centered size="lg">{t("common.loading")}</Spinner>
{:else}
  <div class="form-container">
    {#if error}
      <div class="error">{error}</div>
    {/if}

    <form on:submit|preventDefault={handleSave}>
      <div class="form-group">
        <label for="name">Campaign Name *</label>
        <input
          id="name"
          type="text"
          bind:value={campaign.name}
          required
          placeholder="Enter campaign name"
        />
      </div>

      <div class="form-group">
        <label for="public_id">Public Name</label>
        <input
          id="public_id"
          type="text"
          bind:value={campaign.public_id}
          placeholder="URL-friendly name (e.g. customer-satisfaction-2026)"
        />
        <small style="color: #666;"
          >If empty, form ID will be used in the survey URL</small
        >
      </div>

      <div class="form-group">
        <label for="description">Description</label>
        <textarea
          id="description"
          bind:value={campaign.description}
          rows="3"
          placeholder="Internal notes for this campaign (optional)"
        ></textarea>
      </div>

      {#if !campaign.is_public}
        <div class="form-section email-template-section">
          <div class="section-header">
            <h2>Email Template</h2>
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
                  <option value="">Select a placeholder...</option>
                  {#each availablePlaceholders as placeholder}
                    <option value={placeholder.value}
                      >{placeholder.label}</option
                    >
                  {/each}
                </select>
              </div>
              <div class="editor-toggle">
                <button
                  type="button"
                  class="toggle-btn {editorMode === 'wysiwyg' ? 'active' : ''}"
                  on:click={() => (editorMode = "wysiwyg")}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                  >
                    <path d="M1 3h14v2H1V3zm0 4h14v2H1V7zm0 4h10v2H1v-2z" />
                  </svg>
                  WYSIWYG
                </button>
                <button
                  type="button"
                  class="toggle-btn {editorMode === 'html' ? 'active' : ''}"
                  on:click={() => (editorMode = "html")}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                  >
                    <path
                      d="M5 3l-3 5 3 5h2L4 8l3-5H5zm6 0l3 5-3 5h-2l3-5-3-5h2z"
                    />
                  </svg>
                  HTML
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
              <!-- Always render both editors, toggle visibility with CSS -->
              <div
                bind:this={quillContainer}
                class="quill-editor"
                style="display: {editorMode === 'wysiwyg' ? 'block' : 'none'}"
              ></div>
              <div
                bind:this={monacoContainer}
                class="monaco-editor"
                style="display: {editorMode === 'html' ? 'block' : 'none'}"
              ></div>
            {/if}
          </div>
        </div>
      {/if}

      <div class="form-group">
        <label for="form">Form *</label>
        <select id="form" bind:value={campaign.form_id} required>
          <option value="">Select a form...</option>
          {#each forms as form}
            <option value={form.form_id}>{form.name}</option>
          {/each}
        </select>
        <small style="color: #666; display: block; margin-top: 0.25rem;">
          Select the survey form for this campaign
        </small>
      </div>

      {#if campaign.form_id && formVersions.length > 0}
        <div class="form-group">
          <label for="version">Form Version *</label>
          <select id="version" bind:value={campaign.version_id} required>
            {#each formVersions as version}
              <option value={version.version_id}>
                v{version.version}
                {version.version_description
                  ? `- ${version.version_description}`
                  : ""}
              </option>
            {/each}
          </select>
          {#if formVersions.length === 1}
            <small style="color: #666;">Only one version available</small>
          {/if}
        </div>
      {/if}

      <div class="form-row">
        <div class="form-group">
          <label for="open_on">Open Date</label>
          <input id="open_on" type="date" bind:value={campaign.open_on} />
          <small style="color: #666;"
            >Optional - no start restriction if empty</small
          >
        </div>

        <div class="form-group">
          <label for="close_on">Close Date</label>
          <input id="close_on" type="date" bind:value={campaign.close_on} />
          <small style="color: #666;"
            >Optional - no end restriction if empty</small
          >
        </div>
      </div>

      <div class="form-group">
        <label>
          <input type="checkbox" bind:checked={campaign.is_public} />
          Public survey (anyone with link can respond)
        </label>
        <small style="color: #666; display: block; margin-top: 0.25rem;">
          If enabled, anonymous respondents will be created automatically
        </small>
      </div>

      <div class="form-group">
        <label>
          <input type="checkbox" bind:checked={campaign.allow_retries} />
          Allow multiple attempts
        </label>
        <small style="color: #666; display: block; margin-top: 0.25rem;">
          If disabled, respondents can only complete the survey once
        </small>
      </div>

      <div class="form-group">
        <label>
          <input type="checkbox" bind:checked={campaign.response_persistence} />
          Response persistence
        </label>
        <small style="color: #666; display: block; margin-top: 0.25rem;">
          If enabled, respondents will see their previous answers when reopening
          the survey
        </small>
      </div>

      <div class="form-group">
        <label>
          <input
            type="checkbox"
            bind:checked={campaign.can_edit_after_submit}
          />
          Allow editing after submit
        </label>
        <small style="color: #666; display: block; margin-top: 0.25rem;">
          If enabled, respondents can reopen and edit their submitted responses
        </small>
      </div>

      <div class="form-group">
        <label>
          <input
            type="checkbox"
            bind:checked={campaign.can_reopen_after_submit}
          />
          Can reopen after submit
        </label>
        <small style="color: #666; display: block; margin-top: 0.25rem;">
          If disabled, tokens will be invalidated after submission and redirect
          to homepage
        </small>
      </div>

      <!-- Respondents Section -->
      {#if !campaign.is_public}
        <div class="respondents-section">
          <h3>Respondents</h3>
          <p style="color: #666; margin-bottom: 1rem;">
            Add respondents who will receive survey invitations
          </p>

          <div class="respondent-actions">
            <button
              type="button"
              class="btn-primary"
              on:click={handleConfigureFields}
            >
              ⚙️ Configure Fields
            </button>
            <button
              type="button"
              class="btn-primary"
              on:click={handleImportRespondents}
              disabled={importing || respondentFields.length === 0}
            >
              {#if importing}<span class="spinner-small"></span>{/if}
              📥 Import
            </button>
            <button
              type="button"
              class="btn-primary"
              on:click={handleAddRespondentRow}
              disabled={respondentFields.length === 0}
            >
              ➕ Add Row
            </button>
          </div>

          <div class="form-group" style="margin-top: 1rem;">
            <label>
              <input type="checkbox" bind:checked={autoGenerateToken} />
              Automatically generate tokens for new respondents
            </label>
            <small style="color: #666; display: block; margin-top: 0.25rem;">
              When enabled, tokens will be auto-generated when adding new rows
            </small>
          </div>

          {#if respondentFields.length === 0}
            <div class="empty-state">
              <p style="color: #999; font-style: italic; margin-top: 1rem;">
                Configure fields first to define the structure of your
                respondent table
              </p>
            </div>
          {:else if respondentsLoading}
            <div class="loading-state">
              <Spinner size="md" />
              <p>Loading respondents...</p>
            </div>
          {:else if respondents.length > 0}
            <div class="respondents-table">
              <table>
                <thead>
                  <tr>
                    {#each respondentFields as field}
                      <th>
                        {field.label}
                        {#if field.required}<span style="color: #e53935;"
                            >*</span
                          >{/if}
                      </th>
                    {/each}
                    <th style="width: 100px; text-align: center;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {#each respondents as respondent, index}
                    <tr>
                      {#each respondentFields as field}
                        <td>
                          <input
                            type={field.type}
                            bind:value={respondent[field.name]}
                            required={field.required}
                            class:invalid={!validateRespondentField(
                              respondent[field.name],
                              field,
                            )}
                            placeholder={field.label}
                          />
                        </td>
                      {/each}
                      <td class="action-buttons">
                        <button
                          type="button"
                          class="btn-icon"
                          on:click={() => copySurveyLink(respondent)}
                          title="Copy survey link"
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <rect
                              x="2"
                              y="2"
                              width="8"
                              height="10"
                              rx="1"
                              stroke="currentColor"
                              fill="none"
                              stroke-width="1.5"
                            />
                            <path
                              d="M6 2V1C6 0.4 6.4 0 7 0H13C13.6 0 14 0.4 14 1V11C14 11.6 13.6 12 13 12H12"
                              stroke="currentColor"
                              fill="none"
                              stroke-width="1.5"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          class="btn-icon"
                          on:click={() => removeRespondent(index)}
                          title="Remove respondent"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
              <p style="margin-top: 0.5rem; color: #666;">
                {respondents.length} respondent{respondents.length !== 1
                  ? "s"
                  : ""}
              </p>
            </div>
          {:else}
            <div class="empty-state">
              <p style="color: #999; font-style: italic; margin-top: 1rem;">
                Click "Add Row" to start adding respondents
              </p>
            </div>
          {/if}
        </div>
      {/if}

      <div class="form-actions">
        <button type="button" on:click={handleCancel} class="btn-secondary">
          Cancel
        </button>
        <button type="submit" class="btn-primary" disabled={saving}>
          {#if saving}<span class="spinner-small"></span>{/if}
          {saving ? "Saving..." : "Save Campaign"}
        </button>
      </div>
    </form>
  </div>
{/if}

<ConfigureRespondentFieldsDialog
  bind:show={showConfigureDialog}
  existingFields={respondentFields}
  on:save={handleSaveFieldConfiguration}
/>

<style>
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
  }

  .page-header h1 {
    margin: 0.25rem 0 0 0;
    font-size: 2rem;
    color: var(--color-text);
  }

  .back-link {
    color: var(--color-primary);
    text-decoration: none;
    font-size: 0.875rem;
    display: inline-block;
    margin-bottom: 0.5rem;
  }

  .back-link:hover {
    text-decoration: underline;
  }

  .form-container {
    max-width: 100%;
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: var(--shadow-md);
  }

  .email-template-section {
    max-width: 100%;
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

  .section-header h2 {
    margin: 0;
  }

  .placeholder-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .placeholder-controls label {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
  }

  .placeholder-controls select {
    padding: 0.5rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: white;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--color-text);
  }

  .form-group input,
  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: 0.625rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-size: 1rem;
    font-family: inherit;
    box-sizing: border-box;
  }

  .form-group input:focus,
  .form-group select:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--color-border);
  }

  .error {
    padding: 1rem;
    background: #fee;
    border: 1px solid #fcc;
    border-radius: 4px;
    color: #c00;
    margin-bottom: 1.5rem;
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
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-primary {
    background-color: #4a90e2;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: #3a7bc8;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background-color: #f0f0f0;
    color: #333;
  }

  .btn-secondary:hover:not(:disabled) {
    background-color: #e0e0e0;
  }

  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinner-small {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-right: 8px;
    vertical-align: middle;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

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
    flex-wrap: wrap;
    gap: 1rem;
  }

  .section-header h2 {
    margin: 0;
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
  }

  .placeholder-controls label {
    font-size: 0.9rem;
    font-weight: 500;
    white-space: nowrap;
  }

  .placeholder-controls select {
    padding: 0.4rem 0.8rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: white;
    cursor: pointer;
  }

  .editor-toggle {
    display: flex;
    gap: 0.25rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    overflow: hidden;
    background: white;
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    border: none;
    background: white;
    color: #666;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    transition: all 0.2s;
  }

  .toggle-btn:hover {
    background: #f5f5f5;
  }

  .toggle-btn.active {
    background: var(--color-primary);
    color: white;
  }

  .toggle-btn svg {
    width: 16px;
    height: 16px;
  }

  .email-editor-wrapper {
    background: white;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    overflow: hidden;
    min-height: 400px;
  }

  .editors-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    color: #666;
  }

  .editors-loading p {
    margin-top: 1rem;
    font-size: 0.9rem;
  }

  .quill-editor {
    min-height: 400px;
    background: white;
  }

  /* Placeholder badges styling in Quill editor */
  .quill-editor :global(.placeholder-badge) {
    display: inline-block;
    padding: 2px 8px;
    margin: 0 2px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 12px;
    font-size: 0.85em;
    font-weight: 600;
    cursor: default;
    user-select: none;
    white-space: nowrap;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  }

  .quill-editor :global(.placeholder-badge:hover) {
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    transform: translateY(-1px);
  }

  .monaco-editor {
    min-height: 400px;
    width: 100%;
  }

  .respondents-section {
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 2px solid var(--color-border);
  }

  .respondents-section h3 {
    margin: 0 0 0.5rem 0;
    color: var(--color-text);
  }

  .respondent-actions {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .respondents-table {
    margin-top: 1rem;
    overflow-x: auto;
  }

  .respondents-table table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid var(--color-border);
  }

  .page-header {
    position: sticky;
    top: 0;
    background: white;
    z-index: 100;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 1rem;
  }

  .respondents-table th,
  .respondents-table td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid var(--color-border);
  }

  .respondents-table th {
    background: #f5f5f5;
    font-weight: 600;
    font-size: 0.875rem;
  }

  .respondents-table td {
    font-size: 0.875rem;
  }

  .respondents-table input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.875rem;
  }

  .respondents-table input:focus {
    outline: none;
    border-color: #4a90e2;
  }

  .respondents-table input.invalid {
    border-color: #e53935;
    background-color: #ffebee;
  }

  .empty-state {
    text-align: center;
    padding: 2rem 1rem;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    color: #666;
    gap: 1rem;
  }

  .loading-state p {
    margin: 0;
    font-size: 0.95rem;
  }

  .editors-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    color: #666;
    gap: 1rem;
  }

  .editors-loading p {
    margin: 0;
    font-size: 0.95rem;
  }

  .respondents-table code {
    background: #f0f0f0;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.8rem;
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

  .btn-icon svg {
    color: var(--color-primary);
  }

  .action-buttons {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    justify-content: center;
  }

  .form-group label input[type="checkbox"] {
    width: auto;
    margin-right: 0.5rem;
  }
</style>

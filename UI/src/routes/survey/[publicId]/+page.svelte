<script>
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/stores";
  import { browser } from "$app/environment";
  import Spinner from "$lib/components/Spinner.svelte";
  import { toast } from "$lib/toast.js";

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

  $: publicId = $page.params.publicId;
  $: token = $page.url.searchParams.get("token");

  let loading = true;
  let submitting = false;
  let error = "";
  let surveyModel = null;
  let surveyContainer;
  let survey;
  let campaignData = null;
  let existingResponse = null;

  // Session tracking
  let sessionStart = null;
  let sessions = [];

  onMount(async () => {
    await loadSurvey();
    startSession();
  });

  onDestroy(() => {
    endSession();

    // Dispose survey
    if (survey) {
      try {
        survey.dispose();
      } catch (e) {
        console.warn("Error disposing survey:", e);
      }
    }
  });

  function startSession() {
    sessionStart = new Date().toISOString();

    // Track visibility changes
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }
  }

  function endSession() {
    if (sessionStart) {
      const sessionEnd = new Date().toISOString();
      sessions.push({ from: sessionStart, to: sessionEnd });
      sessionStart = null;
    }

    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      // Tab became hidden - end current session
      if (sessionStart) {
        const sessionEnd = new Date().toISOString();
        sessions.push({ from: sessionStart, to: sessionEnd });
        sessionStart = null;
      }
    } else {
      // Tab became visible - start new session
      sessionStart = new Date().toISOString();
    }
  }

  async function loadSurvey() {
    loading = true;
    error = "";

    try {
      // Check if SurveyJS is loaded globally
      if (!browser || typeof window.Survey === "undefined") {
        throw new Error("SurveyJS library not loaded");
      }

      const url = token
        ? `${API_BASE_URL}/survey/${publicId}?token=${encodeURIComponent(token)}`
        : `${API_BASE_URL}/survey/${publicId}`;

      const res = await fetch(url);

      if (!res.ok) {
        const errorData = await res
          .json()
          .catch(() => ({ message: "Failed to load survey" }));
        throw new Error(errorData.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      campaignData = data;

      // Check if can_reopen_after_submit is false and there's a submitted response
      if (token && data.can_reopen_after_submit === false) {
        try {
          const responseUrl = `${API_BASE_URL}/survey/${publicId}/response/current?token=${encodeURIComponent(token)}`;
          const responseRes = await fetch(responseUrl);
          if (responseRes.ok) {
            const responseData = await responseRes.json();
            if (responseData.status === "completed") {
              // Token not allowed after submission - redirect to homepage
              toast.info("This survey has already been submitted");
              window.location.href = "/";
              return;
            }
          }
        } catch (err) {
          console.warn("Could not check submission status:", err);
        }
      }

      // Create SurveyJS model using global Survey object
      const surveyJson = data.survey_data || data.form_data;
      surveyModel = new window.Survey.Model(surveyJson);

      // If token provided, check for existing response
      if (token) {
        try {
          const responseUrl = `${API_BASE_URL}/survey/${publicId}/response/current?token=${encodeURIComponent(token)}`;
          console.log("Checking for existing response at:", responseUrl);
          const responseRes = await fetch(responseUrl);
          console.log("Response status:", responseRes.status);

          if (responseRes.ok) {
            const responseData = await responseRes.json();
            console.log("Existing response data:", responseData);

            if (responseData.data) {
              surveyModel.data = responseData.data;
              existingResponse = responseData;
              console.log("✅ Loaded existing response into survey");

              // If response is completed and can_edit_after_submit is false, make survey read-only
              if (
                responseData.status === "completed" &&
                campaignData.can_edit_after_submit === false
              ) {
                surveyModel.mode = "display";
                console.log(
                  "Survey set to read-only mode (already submitted, editing not allowed)",
                );
              }
            }
          } else if (responseRes.status === 404) {
            console.log("No existing response found (404) - starting fresh");
          } else {
            const errorData = await responseRes.json().catch(() => ({}));
            console.warn(
              "Error loading existing response:",
              responseRes.status,
              errorData,
            );
          }
        } catch (err) {
          console.warn("Could not load existing response:", err);
        }
      }

      // Set existing response data if available from campaign data
      if (data.existing_response && data.existing_response.data) {
        surveyModel.data = data.existing_response.data;
        existingResponse = data.existing_response;
      }

      // Handle survey completion
      surveyModel.onComplete.add(handleSurveyComplete);

      // Render survey into container
      renderSurvey();
    } catch (err) {
      console.error("Failed to load survey:", err);
      error = err.message || "Failed to load survey";
      toast.error(error);
    } finally {
      loading = false;
    }
  }

  function renderSurvey() {
    if (!browser || !surveyModel) {
      console.warn("Cannot render: browser or surveyModel not ready");
      return;
    }

    if (!surveyContainer) {
      console.warn("surveyContainer not ready, retrying...");
      setTimeout(renderSurvey, 100);
      return;
    }

    try {
      console.log("Starting survey render...");
      console.log("surveyModel:", surveyModel);
      console.log("surveyContainer:", surveyContainer);

      // Clear container
      surveyContainer.innerHTML = "";

      // Dispose old survey
      if (survey) {
        try {
          survey.dispose();
        } catch (e) {
          console.warn("Error disposing survey:", e);
        }
      }

      // Set survey reference before binding
      survey = surveyModel;

      // Create div for Knockout binding
      const surveyDiv = document.createElement("div");
      surveyDiv.setAttribute(
        "data-bind",
        "component: { name: 'survey', params: { survey: survey } }",
      );
      surveyContainer.appendChild(surveyDiv);

      console.log("Applying Knockout bindings...");
      // Apply Knockout bindings with survey variable
      window.ko.applyBindings({ survey: survey }, surveyDiv);

      console.log("✅ Survey rendered successfully");
    } catch (error) {
      console.error("❌ Failed to render survey:", error);
      surveyContainer.innerHTML = `<div style="color: red; padding: 1rem;">Error: ${error.message}</div>`;
    }
  }

  async function handleSurveyComplete(sender) {
    // Disable survey to prevent further edits
    sender.mode = "display";

    submitting = true;
    endSession(); // End final session

    try {
      const completedAt = new Date().toISOString();

      // Calculate total time spent
      const totalTime = sessions.reduce((sum, session) => {
        const start = new Date(session.from);
        const end = new Date(session.to);
        return sum + (end - start);
      }, 0);

      // Get request metadata
      const metadata = {
        user_agent: navigator.userAgent,
        screen_width: screen.width,
        screen_height: screen.height,
        referrer: document.referrer,
        language: navigator.language,
      };

      const payload = {
        data: sender.data,
        completed_at: completedAt,
        time_spent_ms: totalTime,
        sessions: sessions,
        metadata: metadata,
      };

      const url = token
        ? `${API_BASE_URL}/survey/${publicId}/response?token=${encodeURIComponent(token)}`
        : `${API_BASE_URL}/survey/${publicId}/response`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res
          .json()
          .catch(() => ({ message: "Failed to submit response" }));
        throw new Error(errorData.message || `HTTP ${res.status}`);
      }

      toast.success("Survey submitted successfully!");

      // Hide spinner after successful submit
      submitting = false;
    } catch (err) {
      console.error("Failed to submit survey:", err);
      error = err.message || "Failed to submit survey";
      toast.error(error);

      // Re-enable survey if submission failed
      if (surveyModel) {
        surveyModel.mode = "edit";
      }

      // Hide spinner after error
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>{campaignData?.title || "Survey"}</title>
</svelte:head>

<div class="survey-container">
  {#if loading}
    <div class="loading-wrapper">
      <Spinner size="lg" />
      <p>Loading survey...</p>
    </div>
  {:else if error}
    <div class="error-wrapper">
      <h2>Error</h2>
      <p>{error}</p>
    </div>
  {:else if surveyModel}
    <div class="survey-content">
      {#if submitting}
        <div class="submitting-overlay">
          <Spinner size="lg" />
          <p>Submitting your response...</p>
        </div>
      {/if}
      <div bind:this={surveyContainer} id="surveyContainer"></div>
    </div>
  {/if}
</div>

<style>
  .survey-container {
    width: 100%;
    min-height: 100vh;
  }

  .loading-wrapper,
  .error-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    gap: 1rem;
  }

  .loading-wrapper p,
  .error-wrapper p {
    color: #666;
    font-size: 1.1rem;
  }

  .error-wrapper h2 {
    color: #d32f2f;
    margin: 0;
  }

  .survey-content {
    position: relative;
    background: white;
    border-radius: 8px;
    padding: 2rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .submitting-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.95);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    border-radius: 8px;
    z-index: 1000;
  }

  .submitting-overlay p {
    color: #666;
    font-size: 1.1rem;
    font-weight: 500;
  }

  @media (max-width: 768px) {
    .survey-header h1 {
      font-size: 2rem;
    }

    .survey-content {
      padding: 1rem;
    }
  }
</style>

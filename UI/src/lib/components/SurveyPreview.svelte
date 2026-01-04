<script>
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";

  export let surveyJson = {};

  let surveyContainer;
  let survey;

  onMount(() => {
    if (!browser || !surveyContainer) return;

    // Check if SurveyJS is loaded globally
    if (typeof window.Survey === "undefined") {
      surveyContainer.innerHTML = `<div style="color: red; padding: 2rem; text-align: center;">SurveyJS library not loaded</div>`;
      console.error("[SurveyPreview] window.Survey is undefined");
      return;
    }

    renderSurvey();
  });

  function renderSurvey() {
    if (!browser || !surveyContainer) return;

    // Validate survey JSON
    if (!surveyJson || Object.keys(surveyJson).length === 0) {
      surveyContainer.innerHTML = `<div style="color: #999; padding: 2rem; text-align: center;">No survey definition</div>`;
      return;
    }

    // Ensure pages array exists and has content
    if (
      !surveyJson.pages ||
      !Array.isArray(surveyJson.pages) ||
      surveyJson.pages.length === 0
    ) {
      surveyContainer.innerHTML = `<div style="color: #999; padding: 2rem; text-align: center;">Survey has no pages defined</div>`;
      return;
    }

    // Validate each page has elements
    const hasValidPages = surveyJson.pages.some(
      (page) => page.elements && page.elements.length > 0,
    );
    if (!hasValidPages) {
      surveyContainer.innerHTML = `<div style="color: #999; padding: 2rem; text-align: center;">Survey pages have no questions</div>`;
      return;
    }

    try {
      // Clear container
      surveyContainer.innerHTML = "";

      // Dispose old survey
      if (survey) {
        try {
          survey.dispose();
        } catch (e) {
          console.warn("[SurveyPreview] Error disposing survey:", e);
        }
      }

      // Create survey using global Survey object
      survey = new window.Survey.Model(surveyJson);
      survey.showCompletedPage = false;
      survey.showNavigationButtons = true;

      survey.onComplete.add((sender) => {
        console.log("[SurveyPreview] Survey completed:", sender.data);
      });

      // Create div for Knockout binding
      const surveyDiv = document.createElement("div");
      surveyDiv.setAttribute(
        "data-bind",
        "component: { name: 'survey', params: { survey: survey } }",
      );
      surveyContainer.appendChild(surveyDiv);

      // Apply Knockout bindings
      window.ko.applyBindings({ survey: survey }, surveyDiv);

      console.log("[SurveyPreview] ✅ Survey rendered successfully");
    } catch (error) {
      console.error("[SurveyPreview] ❌ Failed to render survey:", error);
      surveyContainer.innerHTML = `<div style="color: red; padding: 1rem;">Error: ${error.message}</div>`;
    }
  }

  // Watch for changes in surveyJson
  $: if (browser && surveyJson && surveyContainer) {
    renderSurvey();
  }

  onDestroy(() => {
    if (survey) {
      try {
        survey.dispose();
      } catch (e) {
        console.warn("[SurveyPreview] Error disposing survey:", e);
      }
    }
  });
</script>

<div class="survey-preview">
  <div bind:this={surveyContainer} class="survey-container"></div>
</div>

<style>
  .survey-preview {
    width: 100%;
    height: 100%;
    overflow: auto;
    background: #f9f9f9;
    padding: 1rem;
  }

  .survey-container {
    width: 100%;
    background: white;
    padding: 1.5rem;
  }

  :global(.sv_main) {
    background: transparent !important;
  }
</style>

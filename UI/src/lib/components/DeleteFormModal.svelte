<script>
  import { createEventDispatcher } from "svelte";

  export let formName = "";
  export let versionCount = 0;
  export let campaignCount = 0;
  export let responseCount = 0;

  const dispatch = createEventDispatcher();

  let options = {
    deleteVersions: true,
    deleteCampaigns: false,
    deleteResponses: false,
  };

  function handleConfirm() {
    dispatch("confirm", options);
  }

  function handleCancel() {
    dispatch("cancel");
  }
</script>

<div class="modal-backdrop" on:click={handleCancel}>
  <div class="modal" on:click|stopPropagation>
    <div class="modal-header">
      <h2>Delete Form: {formName}</h2>
      <button class="close-btn" on:click={handleCancel}>
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>

    <div class="modal-body">
      <div class="warning-box">
        <svg
          class="warning-icon"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <p>This will mark the form as removed. Select what else to remove:</p>
      </div>

      <div class="options">
        <label class="option-item">
          <input type="checkbox" bind:checked={options.deleteVersions} />
          <div class="option-content">
            <strong>Delete all versions</strong>
            <span class="option-count"
              >{versionCount}
              {versionCount === 1 ? "version" : "versions"}</span
            >
            <p class="option-description">Mark all form versions as removed</p>
          </div>
        </label>

        <label class="option-item">
          <input type="checkbox" bind:checked={options.deleteCampaigns} />
          <div class="option-content">
            <strong>Delete related campaigns</strong>
            <span class="option-count"
              >{campaignCount}
              {campaignCount === 1 ? "campaign" : "campaigns"}</span
            >
            <p class="option-description">
              Mark all campaigns using this form as removed
            </p>
          </div>
        </label>

        <label class="option-item">
          <input type="checkbox" bind:checked={options.deleteResponses} />
          <div class="option-content">
            <strong>Delete respondent responses</strong>
            <span class="option-count"
              >{responseCount}
              {responseCount === 1 ? "response" : "responses"}</span
            >
            <p class="option-description">
              Mark all collected responses as removed
            </p>
          </div>
        </label>
      </div>

      <div class="info-box">
        <svg
          class="info-icon"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p>
          Items will be marked as removed (soft delete), not permanently deleted
          from database.
        </p>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn-secondary" on:click={handleCancel}>Cancel</button>
      <button class="btn-danger" on:click={handleConfirm}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
        Delete Selected
      </button>
    </div>
  </div>
</div>

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
    padding: 1rem;
  }

  .modal {
    background: white;
    border-radius: 12px;
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }

  .modal-header {
    padding: 1.5rem;
    border-bottom: 1px solid var(--color-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.25rem;
    color: var(--color-text-secondary);
    transition: color 0.2s;
  }

  .close-btn:hover {
    color: var(--color-text);
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .warning-box {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    margin-bottom: 1.5rem;
  }

  .warning-icon {
    width: 24px;
    height: 24px;
    color: #ef4444;
    flex-shrink: 0;
  }

  .warning-box p {
    margin: 0;
    color: #991b1b;
    font-weight: 500;
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .option-item {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    border: 2px solid var(--color-border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .option-item:hover {
    border-color: var(--color-primary);
    background: var(--color-bg-secondary);
  }

  .option-item input[type="checkbox"] {
    margin-top: 0.25rem;
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  .option-content {
    flex: 1;
  }

  .option-content strong {
    display: block;
    font-size: 1rem;
    color: var(--color-text);
    margin-bottom: 0.25rem;
  }

  .option-count {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    background: var(--color-bg-tertiary);
    border-radius: 4px;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .option-description {
    margin: 0.5rem 0 0 0;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .info-box {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 8px;
  }

  .info-icon {
    width: 20px;
    height: 20px;
    color: #3b82f6;
    flex-shrink: 0;
  }

  .info-box p {
    margin: 0;
    color: #1e40af;
    font-size: 0.875rem;
  }

  .modal-footer {
    padding: 1.5rem;
    border-top: 1px solid var(--color-border);
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  .btn-secondary,
  .btn-danger {
    padding: 0.625rem 1.25rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-secondary {
    background: white;
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
  }

  .btn-secondary:hover {
    background: var(--color-bg-secondary);
    border-color: var(--color-text-tertiary);
  }

  .btn-danger {
    background: var(--color-danger);
    color: white;
  }

  .btn-danger:hover {
    background: #dc2626;
    transform: translateY(-1px);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
</style>

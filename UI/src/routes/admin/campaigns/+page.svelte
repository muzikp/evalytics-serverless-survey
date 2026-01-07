<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { auth } from "$lib/auth.js";
  import { getCampaigns, deleteCampaign } from "$lib/api.js";
  import Spinner from "$lib/components/Spinner.svelte";
  import { translations_store } from "$lib/i18n/index.js";
  import { toast } from "$lib/toast.js";

  $: t = $translations_store;

  let campaigns = [];
  let loading = true;
  let error = "";
  let deleting = null; // Track which campaign is being deleted

  // Check auth
  $: if (!$auth) {
    goto("/login");
  }

  onMount(() => {
    loadCampaigns();
  });

  async function loadCampaigns() {
    loading = true;
    error = "";
    try {
      const result = await getCampaigns();
      campaigns = (result.items || []).sort(
        (a, b) => new Date(b.last_update) - new Date(a.last_update),
      );
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function formatDate(dateString) {
    if (!dateString) return "No deadline";
    return new Date(dateString).toLocaleDateString();
  }

  function getTitle(campaign) {
    if (typeof campaign.title === "string") {
      return campaign.title;
    }
    // If title is an object (multi-language), get first available language
    if (typeof campaign.title === "object" && campaign.title) {
      return (
        campaign.title.en ||
        campaign.title.cs ||
        Object.values(campaign.title)[0] ||
        "Untitled"
      );
    }
    return "Untitled";
  }

  function getDescription(campaign) {
    if (typeof campaign.description === "string") {
      return campaign.description;
    }
    if (typeof campaign.description === "object" && campaign.description) {
      return (
        campaign.description.en ||
        campaign.description.cs ||
        Object.values(campaign.description)[0] ||
        ""
      );
    }
    return "";
  }

  async function handleDelete(campaign) {
    const title = getTitle(campaign);
    const confirmed = confirm(
      `Are you sure you want to delete campaign "${title}"?\n\nThis action cannot be undone.`,
    );

    if (!confirmed) return;

    deleting = campaign.campaign_id;
    try {
      await deleteCampaign(campaign.campaign_id);
      toast.success("Campaign deleted successfully");
      await loadCampaigns(); // Reload the list
    } catch (err) {
      toast.error(`Failed to delete campaign: ${err.message}`);
    } finally {
      deleting = null;
    }
  }
</script>

<svelte:head>
  <title>{t("campaigns.title")} - {t("app.name")}</title>
</svelte:head>

<div class="page-header">
  <h1>{t("campaigns.title")}</h1>
  <a href="/admin/campaigns/new" class="btn-create">New Campaign</a>
</div>

{#if loading}
  <Spinner centered size="lg">{t("common.loading")}</Spinner>
{:else if error}
  <div class="error">{error}</div>
{:else if campaigns.length === 0}
  <div class="empty-state">
    <p>No campaigns yet. Create your first campaign!</p>
  </div>
{:else}
  <div class="campaigns-list">
    {#each campaigns as campaign}
      <div class="campaign-card">
        <div class="campaign-header">
          <h3>{getTitle(campaign)}</h3>
          <span class="badge {campaign.is_public ? 'public' : 'private'}">
            {campaign.is_public ? "🌐 Public" : "🔒 Private"}
          </span>
        </div>
        {#if getDescription(campaign)}
          <p class="description">{getDescription(campaign)}</p>
        {/if}

        <div class="campaign-stats">
          <div class="stat-item">
            <div class="stat-value">{campaign.respondent_count || 0}</div>
            <div class="stat-label">Respondents</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{campaign.invitations_sent || 0}</div>
            <div class="stat-label">Invitations Sent</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">0</div>
            <div class="stat-label">Partial</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">0</div>
            <div class="stat-label">Completed</div>
          </div>
        </div>

        <div class="campaign-meta">
          <div class="meta-item">
            <strong>Form:</strong>
            {campaign.form_name || "Unknown"}
          </div>
          <div class="meta-item">
            <strong>Version:</strong>
            {campaign.form_version || "N/A"}
          </div>
          <div class="meta-item">
            <strong>Opens:</strong>
            {formatDate(campaign.open_on)}
          </div>
          <div class="meta-item">
            <strong>Closes:</strong>
            {formatDate(campaign.close_on)}
          </div>
        </div>
        <div class="campaign-actions">
          <button
            class="btn-primary btn-sm"
            on:click={() => goto(`/admin/campaigns/${campaign.campaign_id}`)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M2 14V11L10.5 2.5C10.6667 2.33333 10.85 2.20833 11.05 2.125C11.25 2.04167 11.4583 2 11.675 2C11.8917 2 12.1 2.04167 12.3 2.125C12.5 2.20833 12.6833 2.34167 12.85 2.525L13.475 3.175C13.6583 3.34167 13.7917 3.525 13.875 3.725C13.9583 3.925 14 4.13333 14 4.35C14 4.56667 13.9583 4.775 13.875 4.975C13.7917 5.175 13.6583 5.35833 13.475 5.525L4.975 14H2ZM11.675 5.5L12.3 4.875L11.675 4.25L11.05 4.875L11.675 5.5Z"
                fill="currentColor"
              />
            </svg>
            Open
          </button>
          <button
            class="btn-danger btn-sm"
            on:click={() => handleDelete(campaign)}
            disabled={deleting === campaign.campaign_id}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5 14C4.45 14 3.97917 13.8042 3.5875 13.4125C3.19583 13.0208 3 12.55 3 12V4H2V2H6V1H10V2H14V4H13V12C13 12.55 12.8042 13.0208 12.4125 13.4125C12.0208 13.8042 11.55 14 11 14H5ZM11 4H5V12H11V4ZM6 11H8V5H6V11ZM8 11H10V5H8V11Z"
                fill="currentColor"
              />
            </svg>
            {deleting === campaign.campaign_id ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .page-header h1 {
    margin: 0;
    font-size: 2rem;
    color: var(--color-text);
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--color-text-secondary);
  }

  .campaigns-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1.5rem;
  }

  .campaign-card {
    padding: 1.5rem;
    background: white;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    box-shadow: var(--shadow-sm);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .campaign-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  .campaign-card h3 {
    margin: 0;
    font-size: 1.25rem;
    flex: 1;
  }

  .badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .badge.public {
    background: #e3f2fd;
    color: #1565c0;
  }

  .badge.private {
    background: #fff3e0;
    color: #e65100;
  }

  .description {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: 0.9rem;
  }

  .campaign-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    padding: 1rem;
    background: var(--color-bg-secondary);
    border-radius: 4px;
  }

  .stat-item {
    text-align: center;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-primary);
    margin-bottom: 0.25rem;
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .campaign-meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    font-size: 0.85rem;
    padding: 1rem;
    background: var(--color-bg-secondary);
    border-radius: 4px;
  }

  .meta-item {
    color: var(--color-text-secondary);
  }

  .meta-item strong {
    color: var(--color-text);
    font-weight: 600;
  }

  .campaign-actions {
    display: flex;
    gap: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--color-border);
  }

  .campaign-actions button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .campaign-actions button svg {
    flex-shrink: 0;
  }

  .btn-sm {
    padding: 0.4rem 1rem;
    font-size: 0.875rem;
    flex: 1;
    border-radius: 4px;
    border: none;
    font-weight: 500;
    transition: all 0.2s;
  }

  .btn-primary {
    background-color: var(--color-primary);
    color: white;
  }

  .btn-primary:hover {
    background-color: var(--color-primary-dark);
  }

  .btn-create {
    display: inline-flex;
    align-items: center;
    padding: 0.625rem 1.25rem;
    background: var(--color-primary);
    color: white;
    text-decoration: none;
    border-radius: var(--radius-md);
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }

  .btn-create:hover {
    background: var(--color-primary-dark);
    transform: translateY(-1px);
    box-shadow:
      0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  .btn-danger {
    background-color: #dc3545;
    color: white;
  }

  .btn-danger:hover:not(:disabled) {
    background-color: #c82333;
  }

  .btn-danger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .campaign-card p {
    margin: 0;
    color: var(--color-text-secondary);
  }

  .error {
    padding: 1rem;
    background: #fee;
    border: 1px solid #fcc;
    border-radius: 4px;
    color: #c00;
  }
</style>

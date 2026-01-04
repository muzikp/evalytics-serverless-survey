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
      campaigns = result.items || [];
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
    if (typeof campaign.title === 'string') {
      return campaign.title;
    }
    // If title is an object (multi-language), get first available language
    if (typeof campaign.title === 'object' && campaign.title) {
      return campaign.title.en || campaign.title.cs || Object.values(campaign.title)[0] || 'Untitled';
    }
    return 'Untitled';
  }

  function getDescription(campaign) {
    if (typeof campaign.description === 'string') {
      return campaign.description;
    }
    if (typeof campaign.description === 'object' && campaign.description) {
      return campaign.description.en || campaign.description.cs || Object.values(campaign.description)[0] || '';
    }
    return '';
  }

  async function handleDelete(campaign) {
    const title = getTitle(campaign);
    const confirmed = confirm(`Are you sure you want to delete campaign "${title}"?\n\nThis action cannot be undone.`);
    
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
  <a href="/admin/campaigns/new" class="btn-primary">New Campaign</a>
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
            {campaign.is_public ? '🌐 Public' : '🔒 Private'}
          </span>
        </div>
        {#if getDescription(campaign)}
          <button 
            class="btn-danger btn-sm" 
            on:click={() => handleDelete(campaign)}
            disabled={deleting === campaign.campaign_id}
          >
            {deleting === campaign.campaign_id ? 'Deleting...' : 'Delete'}
          </button>
          <p class="description">{getDescription(campaign)}</p>
        {/if}
        <div class="campaign-meta">
          <div class="meta-item">
            <strong>Form:</strong> {campaign.form_name || 'Unknown'}
          </div>
          <div class="meta-item">
            <strong>Version:</strong> {campaign.form_version || 'N/A'}
          </div>
          <div class="meta-item">
            <strong>Opens:</strong> {formatDate(campaign.open_on)}
          </div>
          <div class="meta-item">
            <strong>Closes:</strong> {formatDate(campaign.close_on)}
          </div>
        </div>
        <div class="campaign-actions">
          <a href="/admin/campaigns/{campaign.campaign_id}" class="btn-primary btn-sm">Open</a>
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

  .btn-sm {
    padding: 0.4rem 1rem;
    font-size: 0.875rem;
    flex: 1;
  }

  .btn-danger {
    background-color: #dc3545;
    color: white;
    border: none;
    cursor: pointer;
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

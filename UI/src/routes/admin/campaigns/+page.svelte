<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { auth } from "$lib/auth.js";
  import Spinner from "$lib/components/Spinner.svelte";
  import { translations_store } from "$lib/i18n/index.js";

  $: t = $translations_store;

  let campaigns = [];
  let loading = true;
  let error = "";

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
      // TODO: Implement API call
      campaigns = [];
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>{t("campaigns.title")} - {t("app.name")}</title>
</svelte:head>

<div class="page-header">
  <h1>{t("campaigns.title")}</h1>
  <a href="/admin/campaigns/new" class="btn-primary">{t("campaigns.new")}</a>
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
        <h3>{campaign.name}</h3>
        <p>{campaign.description}</p>
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
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .campaign-card {
    padding: 1.5rem;
    background: white;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    box-shadow: var(--shadow-sm);
  }

  .campaign-card h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
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

<script>
  import "../app.css";
  import { base } from "$app/paths";
  import { auth } from "$lib/auth.js";
  import { goto } from "$app/navigation";
  import {
    currentLanguage,
    languages,
    translations_store,
  } from "$lib/i18n/index.js";
  import Toast from "$lib/components/Toast.svelte";
  import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";

  $: t = $translations_store;

  function handleLogout() {
    auth.logout();
    goto("/login");
  }

  function changeLanguage(lang) {
    currentLanguage.set(lang);
  }
</script>

<header class="header">
  <div class="brand">
    <a class="brandLink" href="/" on:click|preventDefault={() => goto("/")}
      >{t("app.name")}</a
    >
  </div>
  <nav class="nav">
    {#if $auth}
      <a href="{base}/admin/forms">{t("forms.title")}</a>
      <a href="{base}/admin/campaigns">{t("campaigns.title")}</a>
      <div class="language-switcher">
        {#each Object.entries(languages) as [code, name]}
          <button
            class="lang-btn"
            class:active={$currentLanguage === code}
            on:click={() => changeLanguage(code)}
            title={name}
          >
            {code.toUpperCase()}
          </button>
        {/each}
      </div>
      <button on:click={handleLogout} class="logout-btn"
        >{t("auth.logout")} ({$auth.user?.email || "User"})</button
      >
    {:else}
      <a href="{base}/login">{t("auth.login")}</a>
    {/if}
  </nav>
</header>

<main class="main">
  <slot />
</main>

<Toast />
<ConfirmDialog />

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 2rem;
    background: white;
    border-bottom: 1px solid var(--color-border);
    box-shadow: var(--shadow-sm);
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .brandLink {
    text-decoration: none;
    font-weight: 700;
    font-size: 1.25rem;
    color: var(--color-primary);
    transition: color 0.2s;
  }

  .brandLink:hover {
    color: var(--color-primary-hover);
  }

  .nav {
    display: flex;
    gap: 1.5rem;
    align-items: center;
  }

  .nav a {
    text-decoration: none;
    color: var(--color-text-secondary);
    font-weight: 500;
    transition: color 0.2s;
    position: relative;
  }

  .nav a:hover {
    color: var(--color-primary);
  }

  .nav a::after {
    content: "";
    position: absolute;
    bottom: -0.25rem;
    left: 0;
    width: 0;
    height: 2px;
    background: var(--color-primary);
    transition: width 0.2s;
  }

  .nav a:hover::after {
    width: 100%;
  }

  .logout-btn {
    background: none;
    border: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    font-family: inherit;
    font-size: inherit;
    padding: 0;
    font-weight: 500;
    transition: color 0.2s;
  }

  .logout-btn:hover {
    color: var(--color-danger);
  }
  .language-switcher {
    display: flex;
    gap: 0.5rem;
    border-left: 1px solid var(--color-border);
    padding-left: 1rem;
    margin-left: 0.5rem;
  }

  .lang-btn {
    background: none;
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    cursor: pointer;
    font-family: inherit;
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-weight: 600;
    transition: all 0.2s;
  }

  .lang-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .lang-btn.active {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }
  .main {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem;
  }
</style>

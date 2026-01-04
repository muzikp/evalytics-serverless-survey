<script>
  import "../app.css";
  import { base } from "$app/paths";
  import { auth } from "$lib/auth.js";
  import { goto } from "$app/navigation";

  function handleLogout() {
    auth.logout();
    goto("/login");
  }
</script>

<header class="header">
  <div class="brand">
    <a class="brandLink" href="{base}/">Evalytics Survey</a>
  </div>
  <nav class="nav">
    {#if $auth}
      <a href="{base}/admin/forms">Forms</a>
      <a href="{base}/admin/form-versions">Versions</a>
      <button on:click={handleLogout} class="logout-btn"
        >Logout ({$auth.user?.email || "User"})</button
      >
    {:else}
      <a href="{base}/login">Login</a>
    {/if}
  </nav>
</header>

<main class="main">
  <slot />
</main>

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

  .main {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem;
  }
</style>

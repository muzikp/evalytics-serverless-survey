<script>
  import { goto } from "$app/navigation";
  import { auth, parseJwt } from "$lib/auth.js";
  import { login } from "$lib/api.js";
  import Spinner from "$lib/components/Spinner.svelte";

  let email = "";
  let password = "";
  let loading = false;
  let error = "";

  async function handleSubmit() {
    error = "";
    loading = true;

    try {
      const response = await login(email, password);
      const user = parseJwt(response.token);
      auth.login(response.token, user);
      goto("/admin/forms");
    } catch (err) {
      error = err.message || "Login failed";
    } finally {
      loading = false;
    }
  }
</script>

<div class="login-container">
  <div class="login-card">
    <div class="logo">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    </div>
    <h1>Evalytics Survey</h1>
    <p class="subtitle">Admin Login</p>

    {#if error}
      <div class="alert alert-error">{error}</div>
    {/if}

    <form on:submit|preventDefault={handleSubmit}>
      <div class="form-group">
        <label for="email">Email</label>
        <input
          id="email"
          type="email"
          bind:value={email}
          required
          disabled={loading}
          placeholder="admin@example.com"
        />
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          required
          disabled={loading}
          placeholder="••••••••"
        />
      </div>

      <button type="submit" class="btn-primary" disabled={loading}>
        {#if loading}
          <Spinner size="sm" />
          Logging in...
        {:else}
          Login
        {/if}
      </button>
    </form>
  </div>
</div>

<style>
  .login-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 80vh;
    padding: 2rem;
  }

  .login-card {
    width: 100%;
    max-width: 420px;
    padding: 3rem;
    background: white;
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-xl);
    animation: fadeIn 0.4s ease-out;
  }

  .logo {
    width: 4rem;
    height: 4rem;
    margin: 0 auto 1.5rem;
    padding: 1rem;
    background: var(--color-primary-light);
    border-radius: var(--radius-lg);
    color: var(--color-primary);
  }

  .logo svg {
    width: 100%;
    height: 100%;
  }

  h1 {
    margin: 0 0 0.5rem 0;
    font-size: 1.75rem;
    font-weight: 700;
    text-align: center;
    color: var(--color-text);
  }

  .subtitle {
    margin: 0 0 2rem 0;
    text-align: center;
    color: var(--color-text-secondary);
    font-size: 0.9375rem;
  }

  .alert {
    padding: 0.875rem 1rem;
    margin-bottom: 1.5rem;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .alert-error {
    background-color: #fef2f2;
    border: 1px solid #fecaca;
    color: var(--color-danger);
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--color-text);
  }

  input {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 0.9375rem;
    font-family: inherit;
    box-sizing: border-box;
    transition: all 0.2s;
  }

  input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-light);
  }

  input:disabled {
    background-color: var(--color-bg-secondary);
    cursor: not-allowed;
    opacity: 0.7;
  }

  .btn-primary {
    width: 100%;
    padding: 0.875rem;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    box-shadow: var(--shadow-sm);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-hover);
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
  }

  .btn-primary:disabled {
    background: var(--color-text-tertiary);
    cursor: not-allowed;
    transform: none;
  }
</style>

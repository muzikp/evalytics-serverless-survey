<script>
  export let size = "md"; // 'sm', 'md', 'lg'
  export let centered = false;
</script>

<div class="spinner-wrapper" class:centered>
  <div
    class="spinner"
    class:spinner-sm={size === "sm"}
    class:spinner-lg={size === "lg"}
  />
  {#if $$slots.default}
    <div class="spinner-text">
      <slot />
    </div>
  {/if}
</div>

<style>
  .spinner-wrapper {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
  }

  .spinner-wrapper.centered {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    min-height: 200px;
    padding: 3rem;
  }

  .spinner {
    display: inline-block;
    width: 24px;
    height: 24px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .spinner-sm {
    width: 16px;
    height: 16px;
    border-width: 2px;
  }

  .spinner-lg {
    width: 48px;
    height: 48px;
    border-width: 4px;
  }

  .spinner-text {
    color: var(--color-text-secondary);
    font-size: 0.875rem;
  }

  .centered .spinner-text {
    margin-top: 0.5rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>

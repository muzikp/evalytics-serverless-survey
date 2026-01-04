<script>
  import { toasts, removeToast } from "$lib/toast.js";
  import { fade, fly } from "svelte/transition";
</script>

<div class="toast-container">
  {#each $toasts as toast (toast.id)}
    <div
      class="toast toast-{toast.type}"
      in:fly={{ y: -50, duration: 300 }}
      out:fade={{ duration: 200 }}
    >
      <div class="toast-content">
        <span class="toast-icon">
          {#if toast.type === "success"}
            ✓
          {:else if toast.type === "error"}
            ✕
          {:else if toast.type === "warning"}
            ⚠
          {:else}
            ℹ
          {/if}
        </span>
        <span class="toast-message">{toast.message}</span>
      </div>
      <button class="toast-close" on:click={() => removeToast(toast.id)}
        >×</button
      >
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 10px;
    pointer-events: none;
  }

  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 300px;
    max-width: 500px;
    padding: 12px 16px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    border-left: 4px solid;
  }

  .toast-success {
    border-left-color: #10b981;
  }

  .toast-error {
    border-left-color: #ef4444;
  }

  .toast-warning {
    border-left-color: #f59e0b;
  }

  .toast-info {
    border-left-color: #3b82f6;
  }

  .toast-content {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
  }

  .toast-icon {
    font-size: 18px;
    font-weight: bold;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
  }

  .toast-success .toast-icon {
    color: #10b981;
    background: #d1fae5;
  }

  .toast-error .toast-icon {
    color: #ef4444;
    background: #fee2e2;
  }

  .toast-warning .toast-icon {
    color: #f59e0b;
    background: #fef3c7;
  }

  .toast-info .toast-icon {
    color: #3b82f6;
    background: #dbeafe;
  }

  .toast-message {
    font-size: 14px;
    color: #1f2937;
    line-height: 1.5;
  }

  .toast-close {
    background: none;
    border: none;
    font-size: 20px;
    color: #9ca3af;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
  }

  .toast-close:hover {
    color: #4b5563;
  }
</style>

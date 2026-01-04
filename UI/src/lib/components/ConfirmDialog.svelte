<script>
  import { confirm } from "$lib/confirm.js";
  import { fly, fade } from "svelte/transition";

  $: dialog = $confirm;

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      dialog.onCancel?.();
    }
  }

  function handleKeydown(event) {
    if (!dialog.isOpen) return;

    if (event.key === "Escape") {
      dialog.onCancel?.();
    } else if (event.key === "Enter" && event.ctrlKey) {
      dialog.onConfirm?.();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if dialog.isOpen}
  <div
    class="modal-backdrop"
    on:click={handleBackdropClick}
    transition:fade={{ duration: 200 }}
  >
    <div
      class="modal-dialog {dialog.type}"
      transition:fly={{ y: -50, duration: 300 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div class="modal-header">
        <h3 id="modal-title" class="modal-title">{dialog.title}</h3>
        <button
          class="modal-close"
          on:click={dialog.onCancel}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div class="modal-body">
        <p>{dialog.message}</p>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={dialog.onCancel}>
          {dialog.cancelText}
        </button>
        <button class="btn btn-{dialog.type}" on:click={dialog.onConfirm}>
          {dialog.confirmText}
        </button>
      </div>
    </div>
  </div>
{/if}

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
    z-index: 10000;
    padding: 1rem;
  }

  .modal-dialog {
    background: white;
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    max-width: 500px;
    width: 100%;
    overflow: hidden;
  }

  .modal-dialog.danger {
    border-top: 4px solid #dc3545;
  }

  .modal-dialog.warning {
    border-top: 4px solid #ffc107;
  }

  .modal-dialog.info {
    border-top: 4px solid #0dcaf0;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #e5e5e5;
  }

  .modal-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #333;
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 2rem;
    line-height: 1;
    color: #999;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .modal-close:hover {
    background: #f5f5f5;
    color: #333;
  }

  .modal-body {
    padding: 1.5rem;
  }

  .modal-body p {
    margin: 0;
    color: #666;
    line-height: 1.6;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    background: #f9f9f9;
    border-top: 1px solid #e5e5e5;
  }

  .btn {
    padding: 0.625rem 1.25rem;
    border: none;
    border-radius: 4px;
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
  }

  .btn-secondary {
    background: #e5e5e5;
    color: #333;
  }

  .btn-secondary:hover {
    background: #d5d5d5;
  }

  .btn-danger {
    background: #dc3545;
    color: white;
  }

  .btn-danger:hover {
    background: #c82333;
  }

  .btn-warning {
    background: #ffc107;
    color: #333;
  }

  .btn-warning:hover {
    background: #e0a800;
  }

  .btn-info {
    background: #0dcaf0;
    color: white;
  }

  .btn-info:hover {
    background: #0bb5d6;
  }
</style>

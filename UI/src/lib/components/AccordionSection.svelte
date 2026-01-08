<script>
  export let title = "";
  export let isOpen = true;
  export let onToggle = () => {};
</script>

<div class="accordion-section">
  <button 
    class="accordion-header" 
    class:open={isOpen}
    on:click={onToggle}
    type="button"
  >
    <span class="accordion-title">{title}</span>
    <span class="accordion-icon">{isOpen ? '▼' : '▶'}</span>
  </button>
  
  {#if isOpen}
    <div class="accordion-content">
      <slot />
    </div>
  {/if}
</div>

<style>
  .accordion-section {
    margin-bottom: 1rem;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    background: white;
  }
  
  .accordion-header {
    width: 100%;
    padding: 1rem 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.1rem;
    font-weight: 600;
    color: #333;
    transition: background-color 0.2s;
  }
  
  .accordion-header:hover {
    background-color: #f5f5f5;
  }
  
  .accordion-header.open {
    border-bottom: 1px solid #e0e0e0;
  }
  
  .accordion-icon {
    color: #666;
    font-size: 0.8rem;
    transition: transform 0.2s;
  }
  
  .accordion-content {
    padding: 1.5rem;
  }
</style>

<script lang="ts">
  import { cn } from '$lib/utils/cn';
  import { saveStatus } from '$lib/stores/save-status';

  interface Props {
    class?: string;
  }

  let { class: className }: Props = $props();
</script>

{#if $saveStatus !== 'idle'}
  <div
    class={cn(
      'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 shadow-sm',
      $saveStatus === 'saving' && 'bg-muted text-muted-foreground animate-save-pulse',
      $saveStatus === 'saved' && 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20',
      $saveStatus === 'error' && 'bg-destructive/10 text-destructive border border-destructive/20',
      className
    )}
  >
    {#if $saveStatus === 'saving'}
      <!-- Spinner -->
      <svg class="size-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>Saving...</span>
    {:else if $saveStatus === 'saved'}
      <!-- Check icon -->
      <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 6 9 17l-5-5"/>
      </svg>
      <span>Saved</span>
    {:else if $saveStatus === 'error'}
      <!-- Error icon -->
      <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span>Error saving</span>
    {/if}
  </div>
{/if}

<script lang="ts">
  import { cn } from '$lib/utils/cn';
  import { toasts, toast, type ToastType } from '$lib/stores/toast';

  const typeStyles: Record<ToastType, string> = {
    default: 'bg-background border-border text-foreground',
    success: 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400',
    error: 'bg-destructive/10 border-destructive/20 text-destructive',
    warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400',
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400'
  };

  const typeIcons: Record<ToastType, string> = {
    default: 'info',
    success: 'check',
    error: 'x',
    warning: 'alert',
    info: 'info'
  };
</script>

{#snippet icon(type: ToastType)}
  {#if type === 'success'}
    <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  {:else if type === 'error'}
    <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" y1="9" x2="9" y2="15"/>
      <line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  {:else if type === 'warning'}
    <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  {:else}
    <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  {/if}
{/snippet}

{#if $toasts.length > 0}
  <div class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
    {#each $toasts as t (t.id)}
      <div
        class={cn(
          'flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg',
          'animate-in slide-in-from-right-full fade-in duration-200',
          typeStyles[t.type]
        )}
        role="alert"
      >
        {@render icon(t.type)}
        <p class="text-sm font-medium">{t.message}</p>
        <button
          type="button"
          class="ml-2 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
          onclick={() => toast.dismiss(t.id)}
        >
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18"/>
            <path d="m6 6 12 12"/>
          </svg>
          <span class="sr-only">Dismiss</span>
        </button>
      </div>
    {/each}
  </div>
{/if}

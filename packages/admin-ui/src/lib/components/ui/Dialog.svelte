<script lang="ts">
  import { cn } from '$lib/utils/cn';
  import { browser } from '$app/environment';

  interface Props {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    class?: string;
    children?: import('svelte').Snippet;
    title?: string;
    description?: string;
    footer?: import('svelte').Snippet;
  }

  let {
    open = false,
    onOpenChange,
    class: className,
    children,
    title,
    description,
    footer
  }: Props = $props();

  function close() {
    onOpenChange?.(false);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      close();
    }
  }

  function handleBackdropClick() {
    close();
  }

  // Handle body scroll lock
  $effect(() => {
    if (!browser) return;

    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  });
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    data-state={open ? 'open' : 'closed'}
    onclick={handleBackdropClick}
    onkeydown={(e) => e.key === 'Enter' && handleBackdropClick()}
    role="button"
    tabindex="-1"
  ></div>

  <!-- Dialog content -->
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby={title ? 'dialog-title' : undefined}
    aria-describedby={description ? 'dialog-description' : undefined}
    data-state={open ? 'open' : 'closed'}
    class={cn(
      'fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border bg-background p-6 shadow-lg duration-200',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
      'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
      'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
      'sm:rounded-lg',
      className
    )}
  >
    {#if title || description}
      <div class="flex flex-col space-y-1.5 text-center sm:text-left">
        {#if title}
          <h2 id="dialog-title" class="text-lg font-semibold leading-none tracking-tight">{title}</h2>
        {/if}
        {#if description}
          <p id="dialog-description" class="text-sm text-muted-foreground">{description}</p>
        {/if}
      </div>
    {/if}

    {#if children}
      {@render children()}
    {/if}

    {#if footer}
      <div class="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
        {@render footer()}
      </div>
    {/if}

    <!-- Close button -->
    <button
      type="button"
      class="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      onclick={close}
    >
      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 6 6 18"/>
        <path d="m6 6 12 12"/>
      </svg>
      <span class="sr-only">Close</span>
    </button>
  </div>
{/if}

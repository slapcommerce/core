<script lang="ts">
  import { cn } from '$lib/utils/cn';
  import { browser } from '$app/environment';

  type Side = 'top' | 'right' | 'bottom' | 'left';

  interface Props {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    side?: Side;
    class?: string;
    children?: import('svelte').Snippet;
    title?: string;
    description?: string;
  }

  let {
    open = false,
    onOpenChange,
    side = 'right',
    class: className,
    children,
    title,
    description
  }: Props = $props();

  // Track visibility and animation state separately
  let visible = $state(false);
  let animating = $state(false);

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

  // Handle open/close with animation
  $effect(() => {
    if (open) {
      visible = true;
      // Small delay to ensure DOM is ready before animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          animating = true;
        });
      });
    } else {
      animating = false;
    }
  });

  function handleTransitionEnd() {
    if (!open) {
      visible = false;
    }
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

<svelte:window onkeydown={visible ? handleKeydown : undefined} />

{#if visible}
  <!-- Backdrop -->
  <div
    class={cn(
      'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm',
      'transition-opacity duration-300 ease-out',
      animating ? 'opacity-100' : 'opacity-0'
    )}
    onclick={handleBackdropClick}
    onkeydown={(e) => e.key === 'Enter' && handleBackdropClick()}
    role="button"
    tabindex="-1"
  ></div>

  <!-- Sheet content -->
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby={title ? 'sheet-title' : undefined}
    ontransitionend={handleTransitionEnd}
    class={cn(
      'sheet-panel fixed z-50 flex flex-col bg-background shadow-2xl',
      'transition-transform duration-300 ease-out',
      // Mobile: fullscreen
      'inset-0 w-full h-full',
      // Desktop: slide-over from side
      side === 'right' && 'md:inset-y-0 md:left-auto md:right-0 md:w-full md:max-w-4xl md:border-l',
      side === 'left' && 'md:inset-y-0 md:right-auto md:left-0 md:w-full md:max-w-4xl md:border-r',
      side === 'top' && 'md:inset-x-0 md:bottom-auto md:top-0 md:h-auto md:max-h-[80vh] md:border-b',
      side === 'bottom' && 'md:inset-x-0 md:top-auto md:bottom-0 md:h-auto md:max-h-[80vh] md:border-t',
      // Animation transforms
      !animating && side === 'right' && 'translate-x-full md:translate-x-full',
      !animating && side === 'left' && '-translate-x-full md:-translate-x-full',
      !animating && side === 'top' && '-translate-y-full md:-translate-y-full',
      !animating && side === 'bottom' && 'translate-y-full md:translate-y-full',
      animating && 'translate-x-0 translate-y-0',
      className
    )}
  >
    <!-- Header -->
    <div class="flex-shrink-0 flex items-center justify-between px-6 py-4">
      {#if title}
        <h2 id="sheet-title" class="text-xl font-semibold text-foreground" style="font-family: var(--font-display);">{title}</h2>
      {/if}

      <!-- Close button -->
      <button
        type="button"
        class="rounded-md p-2 -m-2 opacity-70 ring-offset-background transition-opacity hover:opacity-100 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        onclick={close}
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 6 6 18"/>
          <path d="m6 6 12 12"/>
        </svg>
        <span class="sr-only">Close</span>
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto px-6 pb-6">
      {#if children}
        {@render children()}
      {/if}
    </div>
  </div>
{/if}

<script lang="ts">
  import { cn } from '$lib/utils/cn';
  import { getDropdownContext } from './DropdownMenu.svelte';
  import { browser } from '$app/environment';

  type Align = 'start' | 'center' | 'end';

  interface Props {
    align?: Align;
    class?: string;
    children?: import('svelte').Snippet;
  }

  let { align = 'end', class: className, children }: Props = $props();

  const { open, close } = getDropdownContext();

  let contentRef = $state<HTMLDivElement | null>(null);

  // Close on click outside
  function handleClickOutside(e: MouseEvent) {
    if (contentRef && !contentRef.contains(e.target as Node)) {
      // Check if clicking on trigger
      const trigger = contentRef.parentElement?.querySelector('[role="button"], button');
      if (trigger && trigger.contains(e.target as Node)) {
        return;
      }
      close();
    }
  }

  // Close on Escape
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      close();
    }
  }

  $effect(() => {
    if (!browser) return;

    if ($open) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleKeydown);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeydown);
    };
  });

  const alignClasses: Record<Align, string> = {
    start: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
    end: 'right-0'
  };
</script>

{#if $open}
  <div
    bind:this={contentRef}
    class={cn(
      'absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
      'animate-in fade-in-0 zoom-in-95',
      'top-full mt-1',
      alignClasses[align],
      className
    )}
    role="menu"
  >
    {#if children}
      {@render children()}
    {/if}
  </div>
{/if}

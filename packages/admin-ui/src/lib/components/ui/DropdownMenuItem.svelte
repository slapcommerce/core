<script lang="ts">
  import { cn } from '$lib/utils/cn';
  import { getDropdownContext } from './DropdownMenu.svelte';

  interface Props {
    disabled?: boolean;
    destructive?: boolean;
    class?: string;
    children?: import('svelte').Snippet;
    onclick?: () => void;
  }

  let { disabled = false, destructive = false, class: className, children, onclick }: Props = $props();

  const { close } = getDropdownContext();

  function handleClick() {
    if (disabled) return;
    onclick?.();
    close();
  }
</script>

<button
  type="button"
  role="menuitem"
  {disabled}
  class={cn(
    'relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors',
    'focus:bg-accent focus:text-accent-foreground',
    'hover:bg-accent hover:text-accent-foreground',
    disabled && 'pointer-events-none opacity-50',
    destructive && 'text-destructive focus:bg-destructive/10 focus:text-destructive hover:bg-destructive/10 hover:text-destructive',
    className
  )}
  onclick={handleClick}
>
  {#if children}
    {@render children()}
  {/if}
</button>

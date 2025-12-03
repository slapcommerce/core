<script lang="ts">
  import { cn } from '$lib/utils/cn';

  interface Props {
    class?: string;
    children?: import('svelte').Snippet;
  }

  let { class: className, children }: Props = $props();
</script>

<div
  class={cn(
    'inline-flex w-full items-center border-b border-border',
    className
  )}
  role="tablist"
>
  {#if children}
    {@render children()}
  {/if}
</div>

<script lang="ts">
  import { cn } from '$lib/utils/cn';

  interface Props {
    for?: string;
    class?: string;
    children?: import('svelte').Snippet;
  }

  let {
    for: htmlFor,
    class: className,
    children
  }: Props = $props();

  const baseStyles = 'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70';
</script>

<label
  for={htmlFor}
  class={cn(baseStyles, className)}
>
  {#if children}
    {@render children()}
  {/if}
</label>

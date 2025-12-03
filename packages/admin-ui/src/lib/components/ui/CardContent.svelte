<script lang="ts">
  import { cn } from '$lib/utils/cn';

  interface Props {
    class?: string;
    children?: import('svelte').Snippet;
  }

  let { class: className, children }: Props = $props();

  const baseStyles = 'p-6 pt-0';
</script>

<div class={cn(baseStyles, className)}>
  {#if children}
    {@render children()}
  {/if}
</div>

<script lang="ts">
  import { cn } from '$lib/utils/cn';

  interface Props {
    class?: string;
    children?: import('svelte').Snippet;
  }

  let { class: className, children }: Props = $props();

  const baseStyles = 'flex flex-col space-y-1.5 p-6';
</script>

<div class={cn(baseStyles, className)}>
  {#if children}
    {@render children()}
  {/if}
</div>

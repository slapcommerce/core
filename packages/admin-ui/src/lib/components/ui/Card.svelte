<script lang="ts">
  import { cn } from '$lib/utils/cn';

  interface Props {
    class?: string;
    children?: import('svelte').Snippet;
  }

  let { class: className, children }: Props = $props();

  const baseStyles = 'rounded-xl border bg-card text-card-foreground shadow-sm transition-shadow duration-200 hover:shadow-md';
</script>

<div class={cn(baseStyles, className)}>
  {#if children}
    {@render children()}
  {/if}
</div>

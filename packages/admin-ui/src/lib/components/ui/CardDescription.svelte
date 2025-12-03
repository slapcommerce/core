<script lang="ts">
  import { cn } from '$lib/utils/cn';

  interface Props {
    class?: string;
    children?: import('svelte').Snippet;
  }

  let { class: className, children }: Props = $props();

  const baseStyles = 'text-sm text-muted-foreground leading-relaxed';
</script>

<p class={cn(baseStyles, className)}>
  {#if children}
    {@render children()}
  {/if}
</p>

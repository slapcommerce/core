<script lang="ts">
  import { cn } from '$lib/utils/cn';

  interface Props {
    class?: string;
    style?: string;
    children?: import('svelte').Snippet;
  }

  let { class: className, style, children }: Props = $props();

  const baseStyles = 'text-lg font-semibold leading-none tracking-tight';
  const defaultStyle = 'font-family: var(--font-display);';
</script>

<h3 class={cn(baseStyles, className)} style={style ? `${defaultStyle} ${style}` : defaultStyle}>
  {#if children}
    {@render children()}
  {/if}
</h3>

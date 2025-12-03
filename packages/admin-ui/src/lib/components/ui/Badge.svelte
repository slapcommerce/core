<script lang="ts">
  import { cn } from '$lib/utils/cn';

  type Variant = 'default' | 'secondary' | 'destructive' | 'outline';

  interface Props {
    variant?: Variant;
    class?: string;
    children?: import('svelte').Snippet;
  }

  let { variant = 'default', class: className, children }: Props = $props();

  const variantClasses: Record<Variant, string> = {
    default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
    secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
    destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
    outline: 'text-foreground border-border'
  };
</script>

<div
  class={cn(
    'inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    variantClasses[variant],
    className
  )}
>
  {#if children}
    {@render children()}
  {/if}
</div>

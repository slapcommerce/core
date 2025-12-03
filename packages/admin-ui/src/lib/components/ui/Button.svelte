<script lang="ts">
  import { cn } from '$lib/utils/cn';

  type Variant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  type Size = 'default' | 'sm' | 'lg' | 'icon';

  interface Props {
    variant?: Variant;
    size?: Size;
    class?: string;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    onclick?: (e: MouseEvent) => void;
    'aria-label'?: string;
    children?: import('svelte').Snippet;
  }

  let {
    variant = 'default',
    size = 'default',
    class: className,
    disabled = false,
    type = 'button',
    onclick,
    'aria-label': ariaLabel,
    children
  }: Props = $props();

  const baseStyles = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0';

  const variantStyles: Record<Variant, string> = {
    default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow',
    destructive: 'bg-destructive text-primary-foreground shadow-sm hover:bg-destructive/90 hover:shadow',
    outline: 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
    secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    link: 'text-primary underline-offset-4 hover:underline'
  };

  const sizeStyles: Record<Size, string> = {
    default: 'h-9 px-4 py-2',
    sm: 'h-8 rounded-md px-3 text-xs',
    lg: 'h-10 rounded-md px-8',
    icon: 'h-9 w-9'
  };
</script>

<button
  {type}
  {disabled}
  class={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
  {onclick}
  aria-label={ariaLabel}
>
  {#if children}
    {@render children()}
  {/if}
</button>

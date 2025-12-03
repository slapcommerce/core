<script lang="ts">
  import { cn } from '$lib/utils/cn';

  interface Props {
    type?: string;
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    id?: string;
    name?: string;
    class?: string;
    oninput?: (e: Event) => void;
    onchange?: (e: Event) => void;
    onblur?: (e: FocusEvent) => void;
    onfocus?: (e: FocusEvent) => void;
    onkeydown?: (e: KeyboardEvent) => void;
  }

  let {
    type = 'text',
    value = $bindable(''),
    placeholder,
    disabled = false,
    required = false,
    id,
    name,
    class: className,
    oninput,
    onchange,
    onblur,
    onfocus,
    onkeydown
  }: Props = $props();

  const baseStyles = 'flex h-9 w-full rounded-md border border-input bg-muted/30 px-3 py-1 text-base shadow-sm transition-all duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 md:text-sm';
</script>

<input
  {type}
  {id}
  {name}
  {placeholder}
  {disabled}
  {required}
  bind:value
  class={cn(baseStyles, className)}
  {oninput}
  {onchange}
  {onblur}
  {onfocus}
  {onkeydown}
/>

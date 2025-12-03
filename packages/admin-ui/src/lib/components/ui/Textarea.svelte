<script lang="ts">
  import { cn } from '$lib/utils/cn';

  interface Props {
    value?: string;
    placeholder?: string;
    rows?: number;
    disabled?: boolean;
    id?: string;
    name?: string;
    class?: string;
    onblur?: (e: FocusEvent & { currentTarget: HTMLTextAreaElement }) => void;
    onkeydown?: (e: KeyboardEvent & { currentTarget: HTMLTextAreaElement }) => void;
    oninput?: (e: Event & { currentTarget: HTMLTextAreaElement }) => void;
  }

  let {
    value = $bindable(''),
    placeholder = '',
    rows = 3,
    disabled = false,
    id,
    name,
    class: className,
    onblur,
    onkeydown,
    oninput
  }: Props = $props();
</script>

<textarea
  bind:value
  {id}
  {name}
  {placeholder}
  {rows}
  {disabled}
  {onblur}
  {onkeydown}
  {oninput}
  class={cn(
    'flex min-h-[80px] w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm',
    'ring-offset-background placeholder:text-muted-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'resize-none',
    className
  )}
></textarea>

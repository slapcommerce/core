<script lang="ts" module>
  import { setContext, getContext } from 'svelte';
  import { writable, type Writable } from 'svelte/store';

  const DROPDOWN_KEY = Symbol('dropdown');

  export interface DropdownContext {
    open: Writable<boolean>;
    toggle: () => void;
    close: () => void;
  }

  export function setDropdownContext(ctx: DropdownContext) {
    setContext(DROPDOWN_KEY, ctx);
  }

  export function getDropdownContext(): DropdownContext {
    return getContext<DropdownContext>(DROPDOWN_KEY);
  }
</script>

<script lang="ts">
  import { cn } from '$lib/utils/cn';

  interface Props {
    class?: string;
    children?: import('svelte').Snippet;
  }

  let { class: className, children }: Props = $props();

  const open = writable(false);

  function toggle() {
    open.update(v => !v);
  }

  function close() {
    open.set(false);
  }

  setDropdownContext({ open, toggle, close });
</script>

<div class={cn('relative inline-block', className)}>
  {#if children}
    {@render children()}
  {/if}
</div>

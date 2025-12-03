<script lang="ts" module>
  import { setContext, getContext } from 'svelte';
  import { writable, type Writable } from 'svelte/store';

  const TABS_KEY = Symbol('tabs');

  export interface TabsContext {
    activeTab: Writable<string>;
    setActiveTab: (value: string) => void;
  }

  export function setTabsContext(ctx: TabsContext) {
    setContext(TABS_KEY, ctx);
  }

  export function getTabsContext(): TabsContext {
    return getContext<TabsContext>(TABS_KEY);
  }
</script>

<script lang="ts">
  import { cn } from '$lib/utils/cn';

  interface Props {
    value?: string;
    onValueChange?: (value: string) => void;
    class?: string;
    children?: import('svelte').Snippet;
  }

  let { value = '', onValueChange, class: className, children }: Props = $props();

  // Initialize empty and sync via effect to avoid "initial value capture" warning
  const activeTab = writable('');

  // Sync when controlled value changes
  $effect(() => {
    activeTab.set(value);
  });

  function setActiveTab(newValue: string) {
    activeTab.set(newValue);
    onValueChange?.(newValue);
  }

  setTabsContext({ activeTab, setActiveTab });
</script>

<div class={cn('w-full', className)}>
  {#if children}
    {@render children()}
  {/if}
</div>

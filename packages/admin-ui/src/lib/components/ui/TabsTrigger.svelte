<script lang="ts">
  import { cn } from '$lib/utils/cn';
  import { getTabsContext } from './Tabs.svelte';

  interface Props {
    value: string;
    class?: string;
    children?: import('svelte').Snippet;
  }

  let { value, class: className, children }: Props = $props();

  const { activeTab, setActiveTab } = getTabsContext();

  let isActive = $derived($activeTab === value);
</script>

<button
  type="button"
  role="tab"
  aria-selected={isActive}
  class={cn(
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap px-5 py-3 text-sm font-medium',
    'border-b-2 -mb-px transition-colors duration-150 cursor-pointer',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    isActive
      ? 'text-foreground border-primary'
      : 'text-muted-foreground border-transparent hover:text-foreground',
    className
  )}
  onclick={() => setActiveTab(value)}
>
  {#if children}
    {@render children()}
  {/if}
</button>

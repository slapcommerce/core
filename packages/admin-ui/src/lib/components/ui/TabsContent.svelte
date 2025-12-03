<script lang="ts">
  import { cn } from '$lib/utils/cn';
  import { getTabsContext } from './Tabs.svelte';

  interface Props {
    value: string;
    class?: string;
    children?: import('svelte').Snippet;
  }

  let { value, class: className, children }: Props = $props();

  const { activeTab } = getTabsContext();

  let isActive = $derived($activeTab === value);
</script>

{#if isActive}
  <div
    role="tabpanel"
    class={cn(
      'mt-2 ring-offset-background',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className
    )}
  >
    {#if children}
      {@render children()}
    {/if}
  </div>
{/if}

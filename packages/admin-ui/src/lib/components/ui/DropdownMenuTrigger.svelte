<script lang="ts">
  import { getDropdownContext } from './DropdownMenu.svelte';

  interface Props {
    children?: import('svelte').Snippet;
    asChild?: boolean;
  }

  let { children, asChild = false }: Props = $props();

  const { toggle, open } = getDropdownContext();
</script>

{#if asChild}
  <div onclick={toggle} onkeydown={(e) => e.key === 'Enter' && toggle()} role="button" tabindex="0">
    {#if children}
      {@render children()}
    {/if}
  </div>
{:else}
  <button type="button" onclick={toggle} aria-expanded={$open}>
    {#if children}
      {@render children()}
    {/if}
  </button>
{/if}

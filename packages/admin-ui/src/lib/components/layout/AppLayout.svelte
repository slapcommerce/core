<script lang="ts">
  import Sidebar from './Sidebar.svelte';
  import SiteHeader from './SiteHeader.svelte';
  import { cn } from '$lib/utils/cn';

  interface Props {
    children?: import('svelte').Snippet;
    class?: string;
  }

  let { children, class: className }: Props = $props();

  let sidebarCollapsed = $state(false);
  let mobileMenuOpen = $state(false);

  function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed;
  }
</script>

<div class="flex h-screen overflow-hidden bg-background">
  <!-- Desktop Sidebar -->
  <div class={cn(
    'hidden md:block transition-all duration-300',
    sidebarCollapsed ? 'w-16' : 'w-72'
  )}>
    <Sidebar collapsed={sidebarCollapsed} />
  </div>

  <!-- Mobile sidebar backdrop -->
  {#if mobileMenuOpen}
    <div
      class="fixed inset-0 z-40 bg-black/50 md:hidden"
      onclick={() => mobileMenuOpen = false}
      onkeydown={(e) => e.key === 'Escape' && (mobileMenuOpen = false)}
      role="button"
      tabindex="-1"
    ></div>
  {/if}

  <!-- Mobile Sidebar -->
  <div class={cn(
    'fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 md:hidden',
    mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
  )}>
    <Sidebar />
  </div>

  <!-- Main content -->
  <div class="flex flex-1 flex-col overflow-hidden">
    <!-- Mobile header -->
    <header class="flex h-14 items-center border-b border-border bg-card px-4 md:hidden">
      <button
        onclick={() => mobileMenuOpen = !mobileMenuOpen}
        class="rounded p-2 text-foreground hover:bg-accent"
        aria-label="Toggle menu"
      >
        <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <span class="ml-3 text-lg font-semibold" style="font-family: var(--font-display);">
        <span class="text-primary">Slap</span>Commerce
      </span>
    </header>

    <!-- Desktop header -->
    <SiteHeader onToggleSidebar={toggleSidebar} />

    <!-- Page content -->
    <main class={cn('flex-1 overflow-y-auto', className)}>
      {#if children}
        {@render children()}
      {/if}
    </main>
  </div>
</div>

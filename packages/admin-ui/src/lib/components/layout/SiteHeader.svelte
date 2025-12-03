<script lang="ts">
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { cn } from '$lib/utils/cn';
  import { theme, resolvedTheme } from '$lib/stores/theme';
  import { Button } from '$lib/components/ui';

  interface Props {
    onToggleSidebar?: () => void;
    class?: string;
  }

  let { onToggleSidebar, class: className }: Props = $props();

  function getPageTitle(pathname: string): string {
    // Remove base path and leading/trailing slashes
    const withoutBase = pathname.replace(base, '');
    const segments = withoutBase.replace(/^\/|\/$/g, '').split('/');
    const pageName = segments[segments.length - 1] || 'Dashboard';

    if (pageName === '' || pageName === 'admin') {
      return 'Dashboard';
    }

    // Convert kebab-case to Title Case
    return pageName
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  let pageTitle = $derived(getPageTitle($page.url.pathname));
</script>

{#snippet panelLeftIcon()}
  <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2"/>
    <path d="M9 3v18"/>
  </svg>
{/snippet}

{#snippet sunIcon()}
  <svg class="size-4 transition-transform group-hover:rotate-180 group-hover:text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 2v2"/>
    <path d="M12 20v2"/>
    <path d="m4.93 4.93 1.41 1.41"/>
    <path d="m17.66 17.66 1.41 1.41"/>
    <path d="M2 12h2"/>
    <path d="M20 12h2"/>
    <path d="m6.34 17.66-1.41 1.41"/>
    <path d="m19.07 4.93-1.41 1.41"/>
  </svg>
{/snippet}

{#snippet moonIcon()}
  <svg class="size-4 transition-transform group-hover:-rotate-12 group-hover:text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
  </svg>
{/snippet}

<header class={cn(
  'hidden md:flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 backdrop-blur-sm',
  className
)}>
  <div class="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
    <!-- Sidebar toggle -->
    <Button
      variant="ghost"
      size="sm"
      onclick={onToggleSidebar}
      class="-ml-1 transition-transform hover:scale-110 hover:text-primary"
    >
      {@render panelLeftIcon()}
    </Button>

    <!-- Separator -->
    <div class="mx-2 h-4 w-px bg-gradient-to-b from-transparent via-border to-transparent"></div>

    <!-- Page title -->
    <h1
      class="text-xl font-bold tracking-tight"
      style="font-family: var(--font-display);"
    >
      {pageTitle}
    </h1>

    <!-- Right side -->
    <div class="ml-auto flex items-center gap-2">
      <!-- Theme toggle -->
      <Button
        variant="ghost"
        size="sm"
        onclick={() => theme.toggleTheme()}
        class="group relative overflow-visible"
        aria-label="Toggle theme"
      >
        {#if $resolvedTheme === 'dark'}
          {@render sunIcon()}
        {:else}
          {@render moonIcon()}
        {/if}
        <span class="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          {$resolvedTheme === 'dark' ? 'Light' : 'Dark'} mode
        </span>
      </Button>
    </div>
  </div>
</header>

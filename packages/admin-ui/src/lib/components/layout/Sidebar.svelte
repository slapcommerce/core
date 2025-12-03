<script lang="ts">
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { cn } from '$lib/utils/cn';
  import { auth, currentUser } from '$lib/stores/auth';

  interface Props {
    collapsed?: boolean;
    class?: string;
  }

  let { collapsed = false, class: className }: Props = $props();

  // Navigation items
  const navItems = [
    {
      title: 'Home',
      url: `${base}/`,
      icon: 'home'
    },
    {
      title: 'Products',
      icon: 'box',
      items: [
        { title: 'Products', url: `${base}/products`, icon: 'box' },
        { title: 'Collections', url: `${base}/collections`, icon: 'folder' },
        { title: 'Variants', url: `${base}/variants`, icon: 'package' }
      ]
    }
  ];

  let openSections = $state<Set<string>>(new Set(['Products']));

  function toggleSection(title: string) {
    if (openSections.has(title)) {
      openSections.delete(title);
    } else {
      openSections.add(title);
    }
    openSections = new Set(openSections);
  }

  function isActive(url: string): boolean {
    const currentPath = $page.url.pathname;
    if (url === `${base}/`) {
      return currentPath === `${base}/` || currentPath === `${base}`;
    }
    return currentPath === url;
  }

  function isParentActive(items?: { url: string }[]): boolean {
    if (!items) return false;
    return items.some(item => isActive(item.url));
  }

  async function handleSignOut() {
    await auth.signOut();
  }
</script>

<!-- SVG Icon definitions -->
{#snippet icon(name: string, className?: string, size: string = 'size-4')}
  {#if name === 'home'}
    <svg class={cn(size, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9,22 9,12 15,12 15,22"/>
    </svg>
  {:else if name === 'box'}
    <svg class={cn(size, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
      <path d="m3.3 7 8.7 5 8.7-5"/>
      <path d="M12 22V12"/>
    </svg>
  {:else if name === 'folder'}
    <svg class={cn(size, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  {:else if name === 'package'}
    <svg class={cn(size, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m7.5 4.27 9 5.15"/>
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
      <path d="m3.3 7 8.7 5 8.7-5"/>
      <path d="M12 22V12"/>
    </svg>
  {:else if name === 'settings'}
    <svg class={cn(size, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  {:else if name === 'help'}
    <svg class={cn(size, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
      <path d="M12 17h.01"/>
    </svg>
  {:else if name === 'chevron-right'}
    <svg class={cn(size, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m9 18 6-6-6-6"/>
    </svg>
  {:else if name === 'logo'}
    <svg class={cn(size, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="4"/>
      <line x1="12" y1="2" x2="12" y2="4"/>
      <line x1="12" y1="20" x2="12" y2="22"/>
      <line x1="2" y1="12" x2="4" y2="12"/>
      <line x1="20" y1="12" x2="22" y2="12"/>
    </svg>
  {:else if name === 'logout'}
    <svg class={cn(size, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  {/if}
{/snippet}

<aside class={cn(
  'flex h-screen flex-col bg-sidebar transition-all duration-300',
  collapsed ? 'w-16' : 'w-72',
  className
)}>
  <!-- Header -->
  <div class="flex h-16 items-end pb-3 px-4">
    <a href="{base}/" class="group flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition-all duration-300 hover:translate-x-0.5">
      {@render icon('logo', 'text-primary transition-transform duration-300 group-hover:rotate-12', 'size-[18px]')}
      {#if !collapsed}
        <span class="text-sm font-bold tracking-tight" style="font-family: var(--font-display);">
          <span class="text-primary">Slap</span><span class="text-sidebar-foreground/90">Commerce</span>
        </span>
      {/if}
    </a>
  </div>

  <!-- Navigation -->
  <nav class="flex-1 overflow-y-auto px-4 pt-2 pb-4">
    <ul class="space-y-1">
      {#each navItems as item}
        <li>
          {#if item.items}
            <!-- Parent with children -->
            <button
              onclick={() => toggleSection(item.title)}
              class={cn(
                'group flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isParentActive(item.items)
                  ? 'bg-sidebar-accent text-sidebar-foreground shadow-sm'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
              )}
            >
              <span class={cn(
                'transition-colors duration-200',
                isParentActive(item.items) ? 'text-primary' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70'
              )}>
                {@render icon(item.icon, '', 'size-[18px]')}
              </span>
              {#if !collapsed}
                <span class="flex-1 text-left">{item.title}</span>
                {@render icon('chevron-right', cn(
                  'text-sidebar-foreground/40 transition-transform duration-200',
                  openSections.has(item.title) && 'rotate-90'
                ))}
              {/if}
            </button>
            {#if openSections.has(item.title) && !collapsed}
              <ul class="ml-5 mt-1.5 space-y-0.5 border-l-2 border-sidebar-border/60 pl-3">
                {#each item.items as subItem}
                  <li>
                    <a
                      href={subItem.url}
                      class={cn(
                        'group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] transition-all duration-200',
                        isActive(subItem.url)
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                      )}
                    >
                      <span class={cn(
                        'transition-colors duration-200',
                        isActive(subItem.url) ? 'text-primary' : 'text-sidebar-foreground/40 group-hover:text-sidebar-foreground/60'
                      )}>
                        {@render icon(subItem.icon)}
                      </span>
                      <span>{subItem.title}</span>
                    </a>
                  </li>
                {/each}
              </ul>
            {/if}
          {:else}
            <!-- Single item -->
            <a
              href={item.url}
              class={cn(
                'group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive(item.url)
                  ? 'bg-sidebar-accent text-sidebar-foreground shadow-sm'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
              )}
            >
              <span class={cn(
                'transition-colors duration-200',
                isActive(item.url) ? 'text-primary' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70'
              )}>
                {@render icon(item.icon, '', 'size-[18px]')}
              </span>
              {#if !collapsed}
                <span>{item.title}</span>
              {/if}
            </a>
          {/if}
        </li>
      {/each}
    </ul>

  </nav>

  <!-- Footer / User -->
  <div class="p-4 pt-2">
    <div class="flex items-center gap-3 rounded-xl bg-sidebar-accent/40 px-3 py-2.5 transition-colors duration-200 hover:bg-sidebar-accent/60">
      <div class="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
        {$currentUser?.name?.charAt(0) ?? 'U'}
      </div>
      {#if !collapsed}
        <div class="flex-1 min-w-0">
          <p class="truncate text-sm font-medium text-sidebar-foreground">{$currentUser?.name}</p>
          <p class="truncate text-xs text-sidebar-foreground/50">{$currentUser?.email}</p>
        </div>
        <button
          onclick={handleSignOut}
          class="rounded-lg p-1.5 text-sidebar-foreground/40 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          title="Sign out"
        >
          {@render icon('logout')}
        </button>
      {/if}
    </div>
  </div>
</aside>

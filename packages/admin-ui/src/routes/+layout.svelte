<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { auth, isAuthenticated } from '$lib/stores/auth';

  let { children } = $props();

  // Public routes that don't require auth
  const publicRoutes = [`${base}/login`, `${base}/signup`];

  onMount(() => {
    auth.getSession();
  });

  // Redirect logic based on auth state
  $effect(() => {
    const currentPath = $page.url.pathname;
    const isPublicRoute = publicRoutes.includes(currentPath);

    if (!$auth.loading) {
      if (!$isAuthenticated && !isPublicRoute) {
        goto(`${base}/login`);
      } else if ($isAuthenticated && isPublicRoute) {
        goto(`${base}/`);
      }
    }
  });
</script>

{#if $auth.loading}
  <div class="flex min-h-screen items-center justify-center bg-background">
    <div class="text-muted-foreground">Loading...</div>
  </div>
{:else}
  {@render children()}
{/if}

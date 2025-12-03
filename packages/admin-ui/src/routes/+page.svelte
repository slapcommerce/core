<script lang="ts">
  import { base } from '$app/paths';
  import { AppLayout } from '$lib/components/layout';
  import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '$lib/components/ui';
</script>

<AppLayout>
  <div class="px-6 py-8">
    <h1 class="mb-8 text-2xl font-bold tracking-tight" style="font-family: var(--font-display);">
      Dashboard
    </h1>

    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <a href="{base}/products" class="group block">
        <Card class="h-full">
          <CardHeader>
            <CardTitle>Products</CardTitle>
            <CardDescription>Manage your product catalog</CardDescription>
          </CardHeader>
          <CardContent>
            <span class="inline-flex items-center text-primary text-sm font-medium">
              View Products
              <svg class="ml-1 size-4 transition-transform duration-150 group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14"/>
                <path d="m12 5 7 7-7 7"/>
              </svg>
            </span>
          </CardContent>
        </Card>
      </a>

      <a href="{base}/collections" class="group block">
        <Card class="h-full">
          <CardHeader>
            <CardTitle>Collections</CardTitle>
            <CardDescription>Organize products into collections</CardDescription>
          </CardHeader>
          <CardContent>
            <span class="inline-flex items-center text-primary text-sm font-medium">
              View Collections
              <svg class="ml-1 size-4 transition-transform duration-150 group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14"/>
                <path d="m12 5 7 7-7 7"/>
              </svg>
            </span>
          </CardContent>
        </Card>
      </a>

      <a href="{base}/variants" class="group block">
        <Card class="h-full">
          <CardHeader>
            <CardTitle>Variants</CardTitle>
            <CardDescription>Manage product variants</CardDescription>
          </CardHeader>
          <CardContent>
            <span class="inline-flex items-center text-primary text-sm font-medium">
              View Variants
              <svg class="ml-1 size-4 transition-transform duration-150 group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14"/>
                <path d="m12 5 7 7-7 7"/>
              </svg>
            </span>
          </CardContent>
        </Card>
      </a>
    </div>
  </div>
</AppLayout>

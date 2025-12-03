<script lang="ts">
  import { Tabs, TabsList, TabsTrigger, TabsContent, Skeleton } from '$lib/components/ui';
  import { SaveStatusIndicator } from '$lib/components/shared';
  import { productsStore, products, type Product } from '$lib/stores/products';
  import ProductOverviewTab from './ProductOverviewTab.svelte';
  import ProductVariantsTab from './ProductVariantsTab.svelte';
  import ProductSchedulingTab from './ProductSchedulingTab.svelte';
  import ProductFulfillmentTab from './ProductFulfillmentTab.svelte';
  import ProductDownloadsTab from './ProductDownloadsTab.svelte';
  import ProductSeoTab from './ProductSeoTab.svelte';

  interface Props {
    productId: string;
    initialProduct?: Product;
  }

  let { productId, initialProduct }: Props = $props();

  let activeTab = $state('overview');

  // Get product from store, fallback to initial
  let product = $derived($products.find(p => p.aggregateId === productId) || initialProduct);

  // Build tabs based on product type
  let tabs = $derived(() => {
    if (!product) return [];

    const baseTabs = [
      { id: 'overview', label: 'Overview' },
      { id: 'variants', label: 'Variants' },
      { id: 'scheduling', label: 'Scheduling' }
    ];

    // Add type-specific tabs
    if (product.productType === 'dropship') {
      baseTabs.push({ id: 'fulfillment', label: 'Fulfillment' });
    } else {
      baseTabs.push({ id: 'downloads', label: 'Downloads' });
    }

    // SEO is always last
    baseTabs.push({ id: 'seo', label: 'SEO' });

    return baseTabs;
  });

  // Reset tab when product changes
  $effect(() => {
    if (product) {
      activeTab = 'overview';
    }
  });
</script>

{#if !product}
  <div class="space-y-4">
    <Skeleton class="h-10 w-full" />
    <Skeleton class="h-20 w-full" />
    <Skeleton class="h-20 w-full" />
  </div>
{:else}
  <div class="fixed top-4 right-16 z-50">
    <SaveStatusIndicator />
  </div>

  <Tabs value={activeTab} onValueChange={(value) => activeTab = value} class="w-full">
    <TabsList class="justify-between mb-6">
      {#each tabs() as tab (tab.id)}
        <TabsTrigger value={tab.id}>
          {tab.label}
        </TabsTrigger>
      {/each}
    </TabsList>

    <TabsContent value="overview">
      <ProductOverviewTab {product} />
    </TabsContent>

    <TabsContent value="variants">
      <ProductVariantsTab {product} />
    </TabsContent>

    <TabsContent value="scheduling">
      <ProductSchedulingTab {product} />
    </TabsContent>

    {#if product.productType === 'dropship'}
      <TabsContent value="fulfillment">
        <ProductFulfillmentTab {product} />
      </TabsContent>
    {:else}
      <TabsContent value="downloads">
        <ProductDownloadsTab {product} />
      </TabsContent>
    {/if}

    <TabsContent value="seo">
      <ProductSeoTab {product} />
    </TabsContent>
  </Tabs>
{/if}

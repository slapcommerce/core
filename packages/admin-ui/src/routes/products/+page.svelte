<script lang="ts">
  import { onMount } from 'svelte';
  import { AppLayout } from '$lib/components/layout';
  import { Button, Sheet, Tabs, TabsList, TabsTrigger, Skeleton } from '$lib/components/ui';
  import { Toast } from '$lib/components/shared';
  import { ProductList, ProductSheetContent } from '$lib/components/products';
  import { productsStore, products, productsLoading, type Product, type ProductStatus } from '$lib/stores/products';

  let statusFilter = $state<ProductStatus | 'all'>('all');
  let selectedProduct = $state<Product | null>(null);
  let sheetOpen = $state(false);

  // Filter products by status
  let filteredProducts = $derived(() => {
    if (statusFilter === 'all') return $products;
    return $products.filter(p => p.status === statusFilter);
  });

  function handleEditProduct(product: Product) {
    selectedProduct = product;
    sheetOpen = true;
  }

  function handleCloseSheet() {
    sheetOpen = false;
    selectedProduct = null;
  }

  onMount(() => {
    productsStore.fetchProducts();
  });
</script>

<AppLayout>
  <div class="px-6 py-8">
    <!-- Status Filter Tabs -->
    <div class="mb-6">
      <Tabs value={statusFilter} onValueChange={(value) => statusFilter = value as ProductStatus | 'all'}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>

    <!-- Products List -->
    {#if $productsLoading && $products.length === 0}
      <div class="space-y-4">
        <Skeleton class="h-24 w-full" />
        <Skeleton class="h-24 w-full" />
        <Skeleton class="h-24 w-full" />
      </div>
    {:else}
      <ProductList
        products={filteredProducts()}
        onEditProduct={handleEditProduct}
        onCreateProduct={() => {
          // TODO: Open create product dialog
          console.log('Create product clicked');
        }}
      />
    {/if}
  </div>

  <!-- Product Edit Sheet -->
  <Sheet
    open={sheetOpen}
    onOpenChange={(open) => {
      if (!open) handleCloseSheet();
    }}
    side="right"
    title={selectedProduct?.name || 'Product Details'}
    description="Edit product information"
  >
    {#if selectedProduct}
      <ProductSheetContent
        productId={selectedProduct.aggregateId}
        initialProduct={selectedProduct}
      />
    {/if}
  </Sheet>
</AppLayout>

<!-- Global Toast Container -->
<Toast />

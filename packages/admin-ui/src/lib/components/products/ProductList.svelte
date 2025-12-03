<script lang="ts">
  import { cn } from '$lib/utils/cn';
  import { Input, Button } from '$lib/components/ui';
  import ProductListItem from './ProductListItem.svelte';
  import type { Product } from '$lib/stores/products';

  interface Props {
    products: Product[];
    onEditProduct: (product: Product) => void;
    onCreateProduct?: () => void;
    class?: string;
  }

  let { products, onEditProduct, onCreateProduct, class: className }: Props = $props();

  let searchQuery = $state('');

  let filteredProducts = $derived(() => {
    if (!searchQuery.trim()) return products;

    const query = searchQuery.toLowerCase();
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.slug.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query) ||
        product.vendor.toLowerCase().includes(query) ||
        product.productType.toLowerCase().includes(query)
    );
  });
</script>

{#snippet searchIcon()}
  <svg class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors duration-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.3-4.3"/>
  </svg>
{/snippet}

<div class={cn('flex flex-col gap-6', className)}>
  <!-- Search Bar and Create Button -->
  <div class="flex gap-4">
    <div class="relative flex-1">
      {@render searchIcon()}
      <Input
        placeholder="Search products..."
        bind:value={searchQuery}
        class="pl-10 bg-background border-input hover:border-input transition-all duration-200 shadow-sm"
      />
    </div>
    {#if onCreateProduct}
      <Button onclick={onCreateProduct}>
        + New Product
      </Button>
    {/if}
  </div>

  <!-- Products List -->
  {#if filteredProducts().length > 0}
    {#if filteredProducts().length === 1}
      <!-- Single product: keep original container layout -->
      <div class="rounded-lg border border-border/60 bg-card shadow-sm overflow-hidden transition-all duration-200">
        <ProductListItem
          product={filteredProducts()[0]}
          onEdit={() => onEditProduct(filteredProducts()[0])}
        />
      </div>
    {:else}
      <!-- Multiple products: individual cards with gaps -->
      <div class="flex flex-col gap-4">
        {#each filteredProducts() as product (product.aggregateId)}
          <div class="rounded-lg border border-border/60 bg-card shadow-sm overflow-hidden transition-all duration-200">
            <ProductListItem
              {product}
              onEdit={() => onEditProduct(product)}
            />
          </div>
        {/each}
      </div>
    {/if}
  {:else}
    <div class="rounded-lg border border-border/60 bg-card shadow-sm overflow-hidden transition-all duration-200">
      <div class="flex flex-col items-center justify-center py-16 text-center">
        <svg class="size-12 text-muted-foreground/50 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
          <path d="m3.3 7 8.7 5 8.7-5"/>
          <path d="M12 22V12"/>
        </svg>
        <p class="text-muted-foreground text-base mb-2">
          {searchQuery
            ? `No products found matching "${searchQuery}"`
            : 'No products found'}
        </p>
        {#if searchQuery}
          <button
            onclick={() => searchQuery = ''}
            class="text-primary text-sm font-medium hover:text-primary/80 transition-colors duration-150 cursor-pointer"
          >
            Clear search
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>

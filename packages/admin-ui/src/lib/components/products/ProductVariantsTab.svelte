<script lang="ts">
  import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '$lib/components/ui';
  import type { Product } from '$lib/stores/products';

  interface Props {
    product: Product;
  }

  let { product }: Props = $props();
</script>

<div class="space-y-6 pb-6">
  <Card>
    <CardHeader>
      <CardTitle>Product Variants</CardTitle>
      <CardDescription>
        Manage variants for this product. Variants are created based on your variant options.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <p class="text-sm text-muted-foreground mb-4">
        This product has {product.variantOptions.length} option(s) defined.
      </p>

      {#if product.variantOptions.length > 0}
        <div class="space-y-2 mb-4">
          {#each product.variantOptions as option}
            <div class="text-sm">
              <span class="font-medium">{option.name}:</span>
              <span class="text-muted-foreground ml-2">{option.values.join(', ')}</span>
            </div>
          {/each}
        </div>
      {/if}

      <Button variant="outline">
        Manage Variants
      </Button>
    </CardContent>
  </Card>
</div>

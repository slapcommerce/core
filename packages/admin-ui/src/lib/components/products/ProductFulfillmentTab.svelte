<script lang="ts">
  import { Label, Input, Card, CardHeader, CardTitle, CardDescription, CardContent } from '$lib/components/ui';
  import { productsStore, type Product } from '$lib/stores/products';
  import { currentUser } from '$lib/stores/auth';
  import { saveStatusStore } from '$lib/stores/save-status';
  import { toast } from '$lib/stores/toast';
  import { createAutoSave } from '$lib/utils/auto-save';

  interface Props {
    product: Product;
  }

  let { product }: Props = $props();

  let safetyBuffer = $state('');

  // Sync when product changes
  $effect(() => {
    safetyBuffer = product.dropshipSafetyBuffer?.toString() || '';
  });

  const safetyBufferAutoSave = createAutoSave(async (value: string) => {
    if (!$currentUser?.id) {
      toast.error('You must be logged in to update products');
      return;
    }

    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue === product.dropshipSafetyBuffer) return;

    saveStatusStore.startSaving();
    try {
      await productsStore.updateDropshipProductSafetyBuffer({
        id: product.aggregateId,
        userId: $currentUser.id,
        safetyBuffer: numValue,
        expectedVersion: product.version
      });
      saveStatusStore.completeSave();
      await productsStore.fetchProducts();
    } catch (error) {
      saveStatusStore.failSave();
      toast.error(error instanceof Error ? error.message : 'Failed to update safety buffer');
    }
  });

  function handleSafetyBufferChange(e: Event) {
    const target = e.target as HTMLInputElement;
    safetyBuffer = target.value;
    safetyBufferAutoSave.debouncedSave(target.value);
  }

  function handleSafetyBufferBlur() {
    safetyBufferAutoSave.immediateSave();
  }
</script>

<div class="space-y-6 pb-6">
  <Card>
    <CardHeader>
      <CardTitle>Dropship Fulfillment</CardTitle>
      <CardDescription>
        Configure fulfillment settings for this dropship product.
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="space-y-2">
        <Label for="safetyBuffer">Safety Buffer (days)</Label>
        <Input
          id="safetyBuffer"
          type="number"
          value={safetyBuffer}
          oninput={handleSafetyBufferChange}
          onblur={handleSafetyBufferBlur}
          placeholder="Enter safety buffer in days"
        />
        <p class="text-xs text-muted-foreground">
          Additional days added to estimated delivery time as a buffer.
        </p>
      </div>

      {#if product.fulfillmentProviderId}
        <div class="space-y-2">
          <Label>Fulfillment Provider</Label>
          <p class="text-sm text-muted-foreground">{product.fulfillmentProviderId}</p>
        </div>
      {/if}

      {#if product.supplierSku}
        <div class="space-y-2">
          <Label>Supplier SKU</Label>
          <p class="text-sm text-muted-foreground">{product.supplierSku}</p>
        </div>
      {/if}

      {#if product.supplierCost !== null}
        <div class="space-y-2">
          <Label>Supplier Cost</Label>
          <p class="text-sm text-muted-foreground">${product.supplierCost.toFixed(2)}</p>
        </div>
      {/if}
    </CardContent>
  </Card>
</div>

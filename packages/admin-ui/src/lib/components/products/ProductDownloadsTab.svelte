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

  let maxDownloads = $state('');
  let accessDurationDays = $state('');

  // Sync when product changes
  $effect(() => {
    maxDownloads = product.maxDownloads?.toString() || '';
    accessDurationDays = product.accessDurationDays?.toString() || '';
  });

  async function saveDownloadSettings() {
    if (!$currentUser?.id) {
      toast.error('You must be logged in to update products');
      return;
    }

    const maxDownloadsNum = maxDownloads ? parseInt(maxDownloads, 10) : null;
    const accessDaysNum = accessDurationDays ? parseInt(accessDurationDays, 10) : null;

    // Check if values actually changed
    if (maxDownloadsNum === product.maxDownloads && accessDaysNum === product.accessDurationDays) {
      return;
    }

    saveStatusStore.startSaving();
    try {
      await productsStore.updateProductDownloadSettings({
        id: product.aggregateId,
        userId: $currentUser.id,
        maxDownloads: maxDownloadsNum,
        accessDurationDays: accessDaysNum,
        expectedVersion: product.version
      });
      saveStatusStore.completeSave();
      await productsStore.fetchProducts();
    } catch (error) {
      saveStatusStore.failSave();
      toast.error(error instanceof Error ? error.message : 'Failed to update download settings');
    }
  }

  const downloadAutoSave = createAutoSave(saveDownloadSettings);

  function handleMaxDownloadsChange(e: Event) {
    const target = e.target as HTMLInputElement;
    maxDownloads = target.value;
    downloadAutoSave.debouncedSave(undefined);
  }

  function handleAccessDurationChange(e: Event) {
    const target = e.target as HTMLInputElement;
    accessDurationDays = target.value;
    downloadAutoSave.debouncedSave(undefined);
  }

  function handleBlur() {
    downloadAutoSave.immediateSave();
  }
</script>

<div class="space-y-6 pb-6">
  <Card>
    <CardHeader>
      <CardTitle>Download Settings</CardTitle>
      <CardDescription>
        Configure download limits and access duration for this digital product.
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="space-y-2">
        <Label for="maxDownloads">Maximum Downloads</Label>
        <Input
          id="maxDownloads"
          type="number"
          value={maxDownloads}
          oninput={handleMaxDownloadsChange}
          onblur={handleBlur}
          placeholder="Unlimited"
        />
        <p class="text-xs text-muted-foreground">
          Leave empty for unlimited downloads.
        </p>
      </div>

      <div class="space-y-2">
        <Label for="accessDuration">Access Duration (days)</Label>
        <Input
          id="accessDuration"
          type="number"
          value={accessDurationDays}
          oninput={handleAccessDurationChange}
          onblur={handleBlur}
          placeholder="Unlimited"
        />
        <p class="text-xs text-muted-foreground">
          Leave empty for lifetime access.
        </p>
      </div>
    </CardContent>
  </Card>
</div>

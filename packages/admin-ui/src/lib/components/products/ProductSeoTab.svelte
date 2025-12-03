<script lang="ts">
  import { Label, Input, Textarea, Card, CardHeader, CardTitle, CardDescription, CardContent } from '$lib/components/ui';
  import { productsStore, type Product } from '$lib/stores/products';
  import { currentUser } from '$lib/stores/auth';
  import { saveStatusStore } from '$lib/stores/save-status';
  import { toast } from '$lib/stores/toast';
  import { createAutoSave } from '$lib/utils/auto-save';

  interface Props {
    product: Product;
  }

  let { product }: Props = $props();

  let metaTitle = $state('');
  let metaDescription = $state('');

  // Sync when product changes
  $effect(() => {
    metaTitle = product.metaTitle;
    metaDescription = product.metaDescription;
  });

  async function saveMetadata(field: 'title' | 'description', value: string) {
    if (!$currentUser?.id) {
      toast.error('You must be logged in to update products');
      return;
    }

    // Check if value actually changed
    const currentValue = field === 'title' ? product.metaTitle : product.metaDescription;
    if (value === currentValue) return;

    saveStatusStore.startSaving();
    try {
      await productsStore.updateProductMetadata({
        id: product.aggregateId,
        userId: $currentUser.id,
        metaTitle: field === 'title' ? value : metaTitle,
        metaDescription: field === 'description' ? value : metaDescription,
        expectedVersion: product.version,
        fulfillmentType: product.productType
      });
      saveStatusStore.completeSave();
      await productsStore.fetchProducts();
    } catch (error) {
      // Revert to previous value
      if (field === 'title') metaTitle = product.metaTitle;
      if (field === 'description') metaDescription = product.metaDescription;

      saveStatusStore.failSave();
      toast.error(error instanceof Error ? error.message : 'Failed to update metadata');
    }
  }

  const titleAutoSave = createAutoSave((value: string) => saveMetadata('title', value));
  const descriptionAutoSave = createAutoSave((value: string) => saveMetadata('description', value));

  function handleTitleChange(e: Event) {
    const target = e.target as HTMLInputElement;
    metaTitle = target.value;
    titleAutoSave.debouncedSave(target.value);
  }

  function handleDescriptionChange(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    metaDescription = target.value;
    descriptionAutoSave.debouncedSave(target.value);
  }
</script>

<div class="space-y-6 pb-6">
  <Card>
    <CardHeader>
      <CardTitle>SEO Settings</CardTitle>
      <CardDescription>
        Optimize how this product appears in search engine results.
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="space-y-2">
        <Label for="metaTitle">Meta Title</Label>
        <Input
          id="metaTitle"
          value={metaTitle}
          oninput={handleTitleChange}
          onblur={() => titleAutoSave.immediateSave()}
          placeholder="Enter meta title"
        />
        <p class="text-xs text-muted-foreground">
          {metaTitle.length}/60 characters recommended
        </p>
      </div>

      <div class="space-y-2">
        <Label for="metaDescription">Meta Description</Label>
        <Textarea
          id="metaDescription"
          value={metaDescription}
          oninput={handleDescriptionChange}
          onblur={() => descriptionAutoSave.immediateSave()}
          placeholder="Enter meta description"
          rows={3}
        />
        <p class="text-xs text-muted-foreground">
          {metaDescription.length}/160 characters recommended
        </p>
      </div>

      <!-- Preview -->
      <div class="mt-6 p-4 rounded-lg border border-border bg-muted/30">
        <p class="text-xs text-muted-foreground mb-2">Search Result Preview</p>
        <div class="space-y-1">
          <p class="text-blue-600 dark:text-blue-400 text-lg font-medium truncate">
            {metaTitle || product.name || 'Product Title'}
          </p>
          <p class="text-green-700 dark:text-green-500 text-sm">
            yourstore.com/products/{product.slug}
          </p>
          <p class="text-sm text-muted-foreground line-clamp-2">
            {metaDescription || product.description || 'Product description will appear here...'}
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
</div>

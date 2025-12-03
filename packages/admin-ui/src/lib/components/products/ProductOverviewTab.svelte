<script lang="ts">
  import { Label, Input, Textarea, Badge, Button } from '$lib/components/ui';
  import { productsStore, type Product } from '$lib/stores/products';
  import { currentUser } from '$lib/stores/auth';
  import { saveStatusStore } from '$lib/stores/save-status';
  import { toast } from '$lib/stores/toast';
  import { createAutoSave } from '$lib/utils/auto-save';

  interface Props {
    product: Product;
  }

  let { product }: Props = $props();

  // Form state - initialize empty and sync via effect
  let name = $state('');
  let description = $state('');
  let slug = $state('');
  let tagsInput = $state('');
  let variantOptions = $state<Array<{ name: string; values: string[] }>>([]);

  // Sync form when product changes
  $effect(() => {
    name = product.name;
    description = product.description;
    slug = product.slug;
    tagsInput = product.tags.join(', ');
    variantOptions = product.variantOptions || [];
  });

  // Auto-save handlers
  async function handleAutoSaveDetails(field: 'name' | 'description', value: string) {
    if (!$currentUser?.id) {
      toast.error('You must be logged in to update products');
      return;
    }

    const currentValue = field === 'name' ? product.name : product.description;
    if (value === currentValue) return;

    saveStatusStore.startSaving();
    try {
      await productsStore.updateProductDetails({
        id: product.aggregateId,
        userId: $currentUser.id,
        name: field === 'name' ? value : name,
        description: field === 'description' ? value : description,
        richDescriptionUrl: '',
        expectedVersion: product.version,
        fulfillmentType: product.productType
      });
      saveStatusStore.completeSave();
      await productsStore.fetchProducts();
    } catch (error) {
      if (field === 'name') name = product.name;
      if (field === 'description') description = product.description;
      saveStatusStore.failSave();
      toast.error(error instanceof Error ? error.message : 'Failed to update details');
    }
  }

  async function handleAutoSaveTags() {
    if (!$currentUser?.id) {
      toast.error('You must be logged in to update products');
      return;
    }

    const tags = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    if (tagsInput === product.tags.join(', ')) return;

    saveStatusStore.startSaving();
    try {
      await productsStore.updateProductTags({
        id: product.aggregateId,
        userId: $currentUser.id,
        tags,
        expectedVersion: product.version,
        fulfillmentType: product.productType
      });
      saveStatusStore.completeSave();
      await productsStore.fetchProducts();
    } catch (error) {
      tagsInput = product.tags.join(', ');
      saveStatusStore.failSave();
      toast.error(error instanceof Error ? error.message : 'Failed to update tags');
    }
  }

  async function handleAutoSaveSlug() {
    if (!$currentUser?.id) {
      toast.error('You must be logged in to update products');
      return;
    }

    if (slug === product.slug) return;

    saveStatusStore.startSaving();
    try {
      await productsStore.changeProductSlug({
        id: product.aggregateId,
        userId: $currentUser.id,
        newSlug: slug,
        expectedVersion: product.version,
        fulfillmentType: product.productType
      });
      saveStatusStore.completeSave();
      await productsStore.fetchProducts();
    } catch (error) {
      slug = product.slug;
      saveStatusStore.failSave();
      toast.error(error instanceof Error ? error.message : 'Failed to update slug');
    }
  }

  async function handleAutoSaveOptions(options: typeof variantOptions) {
    if (!$currentUser?.id) {
      toast.error('You must be logged in to update products');
      return;
    }

    saveStatusStore.startSaving();
    try {
      await productsStore.updateProductOptions({
        id: product.aggregateId,
        userId: $currentUser.id,
        variantOptions: options,
        expectedVersion: product.version,
        fulfillmentType: product.productType
      });
      saveStatusStore.completeSave();
      await productsStore.fetchProducts();
    } catch (error) {
      variantOptions = product.variantOptions || [];
      saveStatusStore.failSave();
      toast.error(error instanceof Error ? error.message : 'Failed to update variant options');
    }
  }

  const nameAutoSave = createAutoSave((val: string) => handleAutoSaveDetails('name', val));
  const descriptionAutoSave = createAutoSave((val: string) => handleAutoSaveDetails('description', val));
  const tagsAutoSave = createAutoSave(handleAutoSaveTags);
  const slugAutoSave = createAutoSave(handleAutoSaveSlug);
  const optionsAutoSave = createAutoSave(handleAutoSaveOptions);

  function handleKeyDown(e: KeyboardEvent, saveNow: () => void) {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLElement).blur();
    }
  }

  function addVariantOption() {
    const newOptions = [...variantOptions, { name: '', values: [] }];
    variantOptions = newOptions;
    handleAutoSaveOptions(newOptions);
  }

  function removeVariantOption(index: number) {
    const newOptions = variantOptions.filter((_, i) => i !== index);
    variantOptions = newOptions;
    handleAutoSaveOptions(newOptions);
  }

  function addOptionValue(optionIndex: number, value: string) {
    if (!value.trim()) return;
    const option = variantOptions[optionIndex];
    if (!option || option.values.includes(value.trim())) return;

    const newOptions = [...variantOptions];
    newOptions[optionIndex] = {
      ...option,
      values: [...option.values, value.trim()]
    };
    variantOptions = newOptions;
    handleAutoSaveOptions(newOptions);
  }

  function removeOptionValue(optionIndex: number, valueIndex: number) {
    const option = variantOptions[optionIndex];
    if (!option) return;

    const newOptions = [...variantOptions];
    newOptions[optionIndex] = {
      ...option,
      values: option.values.filter((_, i) => i !== valueIndex)
    };
    variantOptions = newOptions;
    handleAutoSaveOptions(newOptions);
  }

  function updateOptionName(optionIndex: number, newName: string) {
    const newOptions = [...variantOptions];
    if (newOptions[optionIndex]) {
      newOptions[optionIndex] = { ...newOptions[optionIndex], name: newName };
      variantOptions = newOptions;
      optionsAutoSave.debouncedSave(newOptions);
    }
  }
</script>

{#snippet plusIcon()}
  <svg class="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 12h14"/>
    <path d="M12 5v14"/>
  </svg>
{/snippet}

{#snippet trashIcon()}
  <svg class="h-4 w-4 text-muted-foreground hover:text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 6h18"/>
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
  </svg>
{/snippet}

{#snippet xIcon()}
  <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M18 6 6 18"/>
    <path d="m6 6 12 12"/>
  </svg>
{/snippet}

<div class="space-y-6 pb-6">
  <!-- Product Details Section -->
  <div class="space-y-4 rounded-lg border border-border/60 p-5">
    <h3 class="text-base font-semibold" style="font-family: var(--font-display);">Product Details</h3>

    <div class="space-y-4">
      <div class="space-y-2">
        <Label for="name">Name</Label>
        <Input
          id="name"
          bind:value={name}
          oninput={() => nameAutoSave.debouncedSave(name)}
          onblur={() => nameAutoSave.immediateSave()}
          onkeydown={(e) => handleKeyDown(e, () => nameAutoSave.immediateSave())}
        />
      </div>

      <div class="space-y-2">
        <Label for="description">Description</Label>
        <Textarea
          id="description"
          bind:value={description}
          oninput={() => descriptionAutoSave.debouncedSave(description)}
          onblur={() => descriptionAutoSave.immediateSave()}
          rows={3}
        />
      </div>
    </div>
  </div>

  <!-- Slug Section -->
  <div class="space-y-4 rounded-lg border border-border/60 p-5">
    <h3 class="text-base font-semibold" style="font-family: var(--font-display);">URL Slug</h3>

    <div class="space-y-2">
      <Label for="slug">Slug</Label>
      <Input
        id="slug"
        bind:value={slug}
        oninput={() => slugAutoSave.debouncedSave(slug)}
        onblur={() => slugAutoSave.immediateSave()}
        onkeydown={(e) => handleKeyDown(e, () => slugAutoSave.immediateSave())}
      />
      <p class="text-xs text-muted-foreground">
        Used in the product URL: /products/{slug}
      </p>
    </div>
  </div>

  <!-- Tags Section -->
  <div class="space-y-4 rounded-lg border border-border/60 p-5">
    <h3 class="text-base font-semibold" style="font-family: var(--font-display);">Tags</h3>

    <div class="space-y-2">
      <Label for="tags">Tags (comma-separated)</Label>
      <Input
        id="tags"
        bind:value={tagsInput}
        oninput={() => tagsAutoSave.debouncedSave(tagsInput)}
        onblur={() => tagsAutoSave.immediateSave()}
        onkeydown={(e) => handleKeyDown(e, () => tagsAutoSave.immediateSave())}
        placeholder="e.g. summer, sale, featured"
      />
    </div>

    {#if product.tags.length > 0}
      <div class="flex flex-wrap gap-2">
        {#each product.tags as tag}
          <Badge variant="secondary">{tag}</Badge>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Variant Options Section -->
  <div class="space-y-4 rounded-lg border border-border/60 p-5">
    <div class="flex items-center justify-between">
      <h3 class="text-base font-semibold" style="font-family: var(--font-display);">Variant Options</h3>
      <Button variant="outline" size="sm" onclick={addVariantOption}>
        {@render plusIcon()}
        Add Option
      </Button>
    </div>

    <div class="space-y-6">
      {#each variantOptions as option, optionIndex (optionIndex)}
        <div class="space-y-3 rounded-md border p-3">
          <div class="flex items-center gap-3">
            <div class="flex-1">
              <Label for={`option-name-${optionIndex}`}>Option Name</Label>
              <Input
                id={`option-name-${optionIndex}`}
                value={option.name}
                oninput={(e) => updateOptionName(optionIndex, (e.target as HTMLInputElement).value)}
                placeholder="e.g. Size, Color"
                class="mt-1"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              class="mt-6"
              onclick={() => removeVariantOption(optionIndex)}
            >
              {@render trashIcon()}
            </Button>
          </div>

          <div class="space-y-2">
            <Label>Option Values</Label>
            <div class="flex flex-wrap gap-2 mb-2">
              {#each option.values as value, valueIndex (valueIndex)}
                <Badge variant="secondary" class="gap-1 pr-1 py-1 pl-3 text-sm">
                  {value}
                  <button
                    onclick={() => removeOptionValue(optionIndex, valueIndex)}
                    class="ml-1 rounded-full ring-offset-background hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    type="button"
                  >
                    {@render xIcon()}
                    <span class="sr-only">Remove {value}</span>
                  </button>
                </Badge>
              {/each}
              {#if option.values.length === 0}
                <span class="text-sm text-muted-foreground italic self-center">No values added yet.</span>
              {/if}
            </div>
            <div class="flex items-center gap-2 max-w-md">
              <Input
                placeholder="Add value (e.g. Red, Small)..."
                class="h-9 text-sm"
                onblur={(e) => {
                  const input = e.target as HTMLInputElement;
                  addOptionValue(optionIndex, input.value);
                  input.value = '';
                }}
                onkeydown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const input = e.target as HTMLInputElement;
                    addOptionValue(optionIndex, input.value);
                    input.value = '';
                  }
                }}
              />
              <Button variant="outline" size="sm" class="h-9" type="button">
                {@render plusIcon()}
                Add
              </Button>
            </div>
            <p class="text-[10px] text-muted-foreground">
              Type a value and press Enter, click "Add", or click away to save.
            </p>
          </div>
        </div>
      {/each}
      {#if variantOptions.length === 0}
        <p class="text-sm text-muted-foreground text-center py-4">
          No options defined. Add options like "Size" or "Color" to create variants.
        </p>
      {/if}
    </div>
  </div>

  <!-- Collections Section -->
  <div class="space-y-4 rounded-lg border border-border/60 p-5">
    <h3 class="text-base font-semibold" style="font-family: var(--font-display);">Collections</h3>
    <p class="text-xs text-muted-foreground">
      This product is assigned to {product.collections.length} collection(s)
    </p>
    <Button variant="outline" size="sm">
      Manage Collections
    </Button>
  </div>
</div>

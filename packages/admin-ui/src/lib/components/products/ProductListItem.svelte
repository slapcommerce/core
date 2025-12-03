<script lang="ts">
  import { cn } from '$lib/utils/cn';
  import {
    Badge,
    Button,
    Dialog,
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator
  } from '$lib/components/ui';
  import { productsStore, type Product } from '$lib/stores/products';
  import { currentUser } from '$lib/stores/auth';
  import { toast } from '$lib/stores/toast';

  interface Props {
    product: Product;
    onEdit: () => void;
  }

  let { product, onEdit }: Props = $props();

  let showPublishDialog = $state(false);
  let showUnpublishDialog = $state(false);
  let showArchiveDialog = $state(false);
  let isLoading = $state(false);

  let isArchived = $derived(product.status === 'archived');
  let isDraft = $derived(product.status === 'draft');
  let isActive = $derived(product.status === 'active');

  async function handlePublish() {
    if (!$currentUser?.id) {
      toast.error('You must be logged in to publish products');
      return;
    }

    isLoading = true;
    try {
      await productsStore.publishProduct({
        id: product.aggregateId,
        userId: $currentUser.id,
        expectedVersion: product.version,
        fulfillmentType: product.productType
      });
      toast.success('Product published successfully');
      showPublishDialog = false;
      await productsStore.fetchProducts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to publish product');
    } finally {
      isLoading = false;
    }
  }

  async function handleUnpublish() {
    if (!$currentUser?.id) {
      toast.error('You must be logged in to unpublish products');
      return;
    }

    isLoading = true;
    try {
      await productsStore.unpublishProduct({
        id: product.aggregateId,
        userId: $currentUser.id,
        expectedVersion: product.version,
        fulfillmentType: product.productType
      });
      toast.success('Product unpublished successfully');
      showUnpublishDialog = false;
      await productsStore.fetchProducts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to unpublish product');
    } finally {
      isLoading = false;
    }
  }

  async function handleArchive() {
    if (!$currentUser?.id) {
      toast.error('You must be logged in to archive products');
      return;
    }

    isLoading = true;
    try {
      await productsStore.archiveProduct({
        id: product.aggregateId,
        userId: $currentUser.id,
        expectedVersion: product.version,
        fulfillmentType: product.productType
      });
      toast.success('Product archived successfully');
      showArchiveDialog = false;
      await productsStore.fetchProducts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to archive product');
    } finally {
      isLoading = false;
    }
  }
</script>

{#snippet editIcon()}
  <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
    <path d="m15 5 4 4"/>
  </svg>
{/snippet}

{#snippet dotsIcon()}
  <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="1"/>
    <circle cx="19" cy="12" r="1"/>
    <circle cx="5" cy="12" r="1"/>
  </svg>
{/snippet}

{#snippet worldIcon()}
  <svg class="size-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
    <path d="M2 12h20"/>
  </svg>
{/snippet}

{#snippet eyeOffIcon()}
  <svg class="size-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
    <line x1="2" y1="2" x2="22" y2="22"/>
  </svg>
{/snippet}

{#snippet archiveIcon()}
  <svg class="size-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="4" width="20" height="5" rx="2"/>
    <path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/>
    <path d="M10 13h4"/>
  </svg>
{/snippet}

{#snippet packageIcon()}
  <svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="m7.5 4.27 9 5.15"/>
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
    <path d="m3.3 7 8.7 5 8.7-5"/>
    <path d="M12 22V12"/>
  </svg>
{/snippet}

<div class="p-4 lg:p-6 transition-colors duration-150 hover:bg-muted/30">
  <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
    <!-- Left: Product Info -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-3 mb-2">
        <h3 class="font-semibold text-base lg:text-lg truncate">
          {product.name}
        </h3>
        <Badge
          variant={product.status === 'active' ? 'default' : product.status === 'archived' ? 'secondary' : 'outline'}
        >
          {product.status}
        </Badge>
      </div>

      <div class="space-y-1">
        {#if product.description}
          <p class="text-sm text-muted-foreground line-clamp-2">
            {product.description}
          </p>
        {/if}

        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {#if product.vendor}
            <span class="flex items-center gap-1">
              <span class="font-medium">Vendor:</span> {product.vendor}
            </span>
          {/if}
          {#if product.productType}
            <span class="flex items-center gap-1">
              <span class="font-medium">Type:</span> {product.productType}
            </span>
          {/if}
          <span class="flex items-center gap-1">
            {@render packageIcon()}
            <span class="font-medium">Collections:</span> {product.collections.length}
          </span>
        </div>

        {#if product.tags.length > 0}
          <div class="flex flex-wrap gap-1 mt-2">
            {#each product.tags as tag}
              <Badge variant="secondary" class="text-xs">{tag}</Badge>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Right: Actions -->
    <div class="flex items-center gap-2">
      <Button variant="outline" size="sm" onclick={onEdit} class="gap-2">
        {@render editIcon()}
        Edit Details
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" class="size-8 p-0">
            {@render dotsIcon()}
            <span class="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {#if isDraft}
            <DropdownMenuItem onclick={() => showPublishDialog = true} disabled={isLoading}>
              {@render worldIcon()}
              Publish Now
            </DropdownMenuItem>
          {/if}

          {#if isActive}
            <DropdownMenuItem onclick={() => showUnpublishDialog = true} disabled={isLoading}>
              {@render eyeOffIcon()}
              Unpublish Now
            </DropdownMenuItem>
          {/if}

          {#if !isArchived}
            <DropdownMenuItem onclick={() => showArchiveDialog = true} disabled={isLoading}>
              {@render archiveIcon()}
              Archive Now
            </DropdownMenuItem>
          {/if}

          <DropdownMenuSeparator />
          <DropdownMenuItem>
            {@render packageIcon()}
            <span class="ml-2">Manage Variants</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
</div>

<!-- Publish Dialog -->
<Dialog
  open={showPublishDialog}
  onOpenChange={(open) => showPublishDialog = open}
  title="Publish Product"
  description={`Are you sure you want to publish "${product.name}"? This will make it visible to customers.`}
>
  {#snippet footer()}
    <Button variant="outline" onclick={() => showPublishDialog = false}>
      Cancel
    </Button>
    <Button onclick={handlePublish} disabled={isLoading}>
      {isLoading ? 'Publishing...' : 'Publish'}
    </Button>
  {/snippet}
</Dialog>

<!-- Unpublish Dialog -->
<Dialog
  open={showUnpublishDialog}
  onOpenChange={(open) => showUnpublishDialog = open}
  title="Unpublish Product"
  description={`Are you sure you want to unpublish "${product.name}"? This will hide it from customers.`}
>
  {#snippet footer()}
    <Button variant="outline" onclick={() => showUnpublishDialog = false}>
      Cancel
    </Button>
    <Button onclick={handleUnpublish} disabled={isLoading}>
      {isLoading ? 'Unpublishing...' : 'Unpublish'}
    </Button>
  {/snippet}
</Dialog>

<!-- Archive Dialog -->
<Dialog
  open={showArchiveDialog}
  onOpenChange={(open) => showArchiveDialog = open}
  title="Archive Product"
  description={`Are you sure you want to archive "${product.name}"? Archived products are hidden from all listings.`}
>
  {#snippet footer()}
    <Button variant="outline" onclick={() => showArchiveDialog = false}>
      Cancel
    </Button>
    <Button variant="destructive" onclick={handleArchive} disabled={isLoading}>
      {isLoading ? 'Archiving...' : 'Archive'}
    </Button>
  {/snippet}
</Dialog>

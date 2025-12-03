import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useQueryClient } from "@tanstack/react-query";
import { type Product } from "@/admin/hooks/use-products";
import {
  useProductVariants,
  type ProductVariant,
} from "@/admin/hooks/use-product-variants";
import { useReorderProductVariants } from "@/admin/hooks/use-reorder-product-variants";
import { useSetDefaultVariant } from "@/admin/hooks/use-set-default-variant";
import { useSaveStatus } from "@/admin/contexts/save-status-context";
import type { Variant } from "@/admin/hooks/use-variants";
import { Button } from "@/admin/components/ui/button";
import { IconPlus, IconPackage } from "@tabler/icons-react";
import { Skeleton } from "@/admin/components/ui/skeleton";
import { useSheetStack } from "@/admin/components/ui/sheet-stack";
import { VariantSheetContent } from "@/admin/components/variant-sheet-content";
import { CreateVariantDialog } from "@/admin/components/create-variant-dialog";
import { SortableVariantItem } from "@/admin/components/sortable-variant-item";

interface ProductVariantsTabProps {
  product: Product;
}

export function ProductVariantsTab({ product }: ProductVariantsTabProps) {
  const { data: variants, isLoading, error } = useProductVariants({
    productId: product.aggregateId,
  });
  const stack = useSheetStack();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const reorderMutation = useReorderProductVariants();
  const setDefaultMutation = useSetDefaultVariant();
  const saveStatus = useSaveStatus();
  const [localVariants, setLocalVariants] = React.useState<ProductVariant[]>([]);

  // Sync local state with fetched data
  React.useEffect(() => {
    if (variants) {
      setLocalVariants(variants);
    }
  }, [variants]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const reorderVariants = (newOrder: ProductVariant[]) => {
    setLocalVariants(newOrder);

    // Build positions array with new indices
    const variantPositions = newOrder.map((v, index) => ({
      variantId: v.variantId,
      position: index,
    }));

    saveStatus.startSaving();
    reorderMutation.mutate(
      {
        productId: product.aggregateId,
        variantPositions,
        userId: "admin", // TODO: Get from auth context
      },
      {
        onSuccess: () => saveStatus.completeSave(),
        onError: () => saveStatus.failSave(),
      }
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localVariants.findIndex((v) => v.variantId === active.id);
      const newIndex = localVariants.findIndex((v) => v.variantId === over.id);
      const newOrder = arrayMove(localVariants, oldIndex, newIndex);
      reorderVariants(newOrder);
    }
  };

  const handleMoveToTop = (variantId: string) => {
    const index = localVariants.findIndex((v) => v.variantId === variantId);
    if (index > 0) {
      const newOrder = arrayMove(localVariants, index, 0);
      reorderVariants(newOrder);
    }
  };

  const handleMoveToBottom = (variantId: string) => {
    const index = localVariants.findIndex((v) => v.variantId === variantId);
    if (index < localVariants.length - 1) {
      const newOrder = arrayMove(localVariants, index, localVariants.length - 1);
      reorderVariants(newOrder);
    }
  };

  const handleSetDefault = (variant: ProductVariant) => {
    // Try to get fresh product version from cache
    const cachedProducts = queryClient.getQueryData<Product[]>(["products"]) ?? [];
    const freshProduct = cachedProducts.find(p => p.aggregateId === product.aggregateId);
    const currentVersion = freshProduct?.version ?? product.version;

    saveStatus.startSaving();
    setDefaultMutation.mutate(
      {
        productId: product.aggregateId,
        variantId: variant.variantId,
        expectedVersion: currentVersion,
        userId: "admin", // TODO: Get from auth context
      },
      {
        onSuccess: () => saveStatus.completeSave(),
        onError: () => saveStatus.failSave(),
      }
    );
  };

  // Helper function to compute display name
  const getDisplayName = (variant: ProductVariant) => {
    return `${product.name} - ${Object.keys(variant.options).length > 0 ? Object.values(variant.options).join(', ') : 'primary'}`;
  };

  // Map ProductVariant to Variant for VariantSheetContent
  const toVariant = (pv: ProductVariant): Variant => ({
    aggregateId: pv.variantId,
    variant_id: pv.variantId,
    productId: pv.productId,
    sku: pv.sku,
    listPrice: pv.listPrice,
    saleType: pv.saleType,
    saleValue: pv.saleValue,
    activePrice: pv.activePrice,
    inventory: pv.inventory,
    options: pv.options,
    status: pv.variantStatus,
    correlationId: pv.variantCorrelationId,
    version: pv.variantVersion,
    created_at: pv.variantCreatedAt,
    updated_at: pv.variantUpdatedAt,
    images: pv.images,
    digital_asset: pv.digitalAsset,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm text-destructive">
          Failed to load variants: {error.message}
        </p>
      </div>
    );
  }

  const handleEditVariant = (variant: ProductVariant, displayName: string) => {
    stack.push(
      <VariantSheetContent variantId={variant.variantId} initialVariant={toVariant(variant)} />,
      displayName
    );
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Product Variants</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {localVariants.length} variant(s) for this product
            {localVariants.length > 1 && " - drag to reorder"}
          </p>
        </div>
        <Button
          size="sm"
          className="gap-2"
          onClick={() => setIsCreateDialogOpen(true)}
        >
          <IconPlus className="size-4" />
          Add Variant
        </Button>
      </div>

      {/* Variants List */}
      {localVariants.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={localVariants.map((v) => v.variantId)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {localVariants.map((variant, index) => (
                <SortableVariantItem
                  key={variant.variantId}
                  variant={variant}
                  position={index}
                  isDefault={variant.variantId === variant.defaultVariantId}
                  isFirst={index === 0}
                  isLast={index === localVariants.length - 1}
                  displayName={getDisplayName(variant)}
                  onEdit={() => handleEditVariant(variant, getDisplayName(variant))}
                  onSetDefault={() => handleSetDefault(variant)}
                  onMoveToTop={() => handleMoveToTop(variant.variantId)}
                  onMoveToBottom={() => handleMoveToBottom(variant.variantId)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="rounded-lg border border-border/60 p-8 text-center">
          <div className="flex flex-col items-center gap-2">
            <IconPackage className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No variants found for this product
            </p>
          </div>
        </div>
      )}

      <CreateVariantDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        defaultProductId={product.aggregateId}
      />
    </div>
  );
}

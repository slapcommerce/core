import * as React from "react";
import type { Product } from "@/hooks/use-products";
import { useVariants, type Variant } from "@/hooks/use-variants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconPlus, IconLoader2, IconPackage, IconEdit } from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSheetStack } from "@/components/ui/sheet-stack";
import { VariantSheetContent } from "@/components/variant-sheet-content";
import { CreateVariantDialog } from "@/components/create-variant-dialog";

interface ProductVariantsTabProps {
  product: Product;
}

export function ProductVariantsTab({ product }: ProductVariantsTabProps) {
  const { data: variants, isLoading, error } = useVariants({
    productId: product.aggregate_id,
  });
  const stack = useSheetStack();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);

  // Helper function to compute display name
  const getDisplayName = (variant: Variant) => {
    return `${product.title} - ${Object.keys(variant.options).length > 0 ? Object.values(variant.options).join(', ') : 'primary'}`;
  };

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

  const handleEditVariant = (variant: Variant, displayName: string) => {
    stack.push(
      <VariantSheetContent variantId={variant.aggregate_id} initialVariant={variant} />,
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
            {variants?.length || 0} variant(s) for this product
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
      {variants && variants.length > 0 ? (
        <div className="space-y-3">
          {variants.map((variant) => (
            <div
              key={variant.variant_id}
              className="rounded-lg border border-border/60 p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconPackage className="size-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{getDisplayName(variant)}</span>
                  <Badge
                    variant={
                      variant.status === "active"
                        ? "default"
                        : variant.status === "archived"
                          ? "secondary"
                          : "outline"
                    }
                    className="text-xs"
                  >
                    {variant.status}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditVariant(variant, getDisplayName(variant))}
                  className="gap-2"
                >
                  <IconEdit className="size-4" />
                  Edit
                </Button>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  <span className="font-medium">SKU:</span>{" "}
                  {variant.sku}
                </span>
                <span>
                  <span className="font-medium">Price:</span> ${variant.price.toFixed(2)}
                </span>
                <span>
                  <span className="font-medium">Inventory:</span> {variant.inventory}
                </span>
              </div>
            </div>
          ))}
        </div>
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
        defaultProductId={product.aggregate_id}
      />
    </div>
  );
}

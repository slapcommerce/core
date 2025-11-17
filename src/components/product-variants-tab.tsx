import * as React from "react";
import type { Product } from "@/hooks/use-products";
import { useProductVariants } from "@/hooks/use-variants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconPlus, IconLoader2, IconPackage } from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ProductVariantsTabProps {
  product: Product;
}

export function ProductVariantsTab({ product }: ProductVariantsTabProps) {
  const { data: variants, isLoading, error } = useProductVariants({
    productId: product.aggregate_id,
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
        <Button size="sm" className="gap-2" disabled>
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
                  <span className="font-medium text-sm">{variant.title}</span>
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
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  <span className="font-medium">Variant ID:</span>{" "}
                  {variant.variant_id.substring(0, 8)}...
                </span>
                <span>
                  <span className="font-medium">Created:</span>{" "}
                  {new Date(variant.created_at).toLocaleDateString()}
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

      {/* Info Banner */}
      <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <IconLoader2 className="size-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Variant Management Coming Soon
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Full variant editing capabilities (SKU, price, inventory, options) are
              currently in development. For now, variants are displayed in read-only
              mode.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

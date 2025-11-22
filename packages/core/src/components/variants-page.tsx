import * as React from "react";
import { useVariants, type Variant } from "@/hooks/use-variants";
import { useProducts } from "@/hooks/use-products";
import { useSearch } from "@tanstack/react-router";
import { VariantList } from "@/components/variant-list";
import { VariantSlideOver } from "@/components/variant-slide-over";
import { CreateVariantDialog } from "@/components/create-variant-dialog";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { IconPlus } from "@tabler/icons-react";

export function VariantsPage() {
  const search = useSearch({ from: "/admin/products/variants" }) as { productId?: string };
  const { data: variants, isLoading: variantsLoading, error: variantsError } = useVariants(
    search.productId ? { productId: search.productId } : undefined
  );
  const { data: products, isLoading: productsLoading } = useProducts();

  const [selectedVariant, setSelectedVariant] = React.useState<Variant | null>(null);
  const [slideOverOpen, setSlideOverOpen] = React.useState(false);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);

  const isLoading = variantsLoading || productsLoading;
  const error = variantsError;

  // Sync selectedVariant with latest data from React Query after mutations
  React.useEffect(() => {
    if (selectedVariant && variants) {
      const updatedVariant = variants.find(
        (v) => v.variant_id === selectedVariant.variant_id
      );
      if (updatedVariant && updatedVariant.version !== selectedVariant.version) {
        setSelectedVariant(updatedVariant);
      }
    }
  }, [variants, selectedVariant?.variant_id, selectedVariant?.version]);

  const handleEditVariant = (variant: Variant) => {
    setSelectedVariant(variant);
    setSlideOverOpen(true);
  };

  const handleSlideOverClose = () => {
    setSlideOverOpen(false);
    // Delay clearing selection to allow slide animation to complete
    setTimeout(() => setSelectedVariant(null), 300);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          {/* Header */}
          <div className="px-4 lg:px-6">
            {variants && variants.length > 0 && (
              <div className="flex items-center justify-end">
                <Button
                  className="gap-2"
                  onClick={() => setCreateDialogOpen(true)}
                >
                  <IconPlus className="size-4" />
                  New Variant
                </Button>
              </div>
            )}
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="space-y-4 px-4 lg:px-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : error ? (
            <div className="px-4 lg:px-6">
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-8 text-center">
                <p className="text-destructive">
                  Failed to load variants: {error.message}
                </p>
              </div>
            </div>
          ) : variants && variants.length > 0 && products ? (
            <VariantList data={variants} products={products} onEditVariant={handleEditVariant} />
          ) : (
            <div className="px-4 lg:px-6">
              <Empty
                title="No variants yet"
                description="Get started by creating your first variant"
                action={{
                  label: "Create Variant",
                  onClick: () => setCreateDialogOpen(true),
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Slide-over for editing variants */}
      <VariantSlideOver
        variant={selectedVariant}
        open={slideOverOpen}
        onOpenChange={handleSlideOverClose}
      />

      {/* Dialog for creating variants */}
      <CreateVariantDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        defaultProductId={search.productId}
      />
    </div>
  );
}

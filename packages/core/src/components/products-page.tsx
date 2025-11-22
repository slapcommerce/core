import * as React from "react";
import { useProducts, type Product } from "@/hooks/use-products";
import { ProductList } from "@/components/product-list";
import { ProductSlideOver } from "@/components/product-slide-over";
import { CreateProductDialog } from "@/components/create-product-dialog";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { IconPlus } from "@tabler/icons-react";

export function ProductsPage() {
  const { data: products, isLoading, error } = useProducts();
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(
    null
  );
  const [slideOverOpen, setSlideOverOpen] = React.useState(false);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);

  // Sync selectedProduct with latest data from React Query after mutations
  React.useEffect(() => {
    if (selectedProduct && products) {
      const updatedProduct = products.find(
        (p) => p.aggregate_id === selectedProduct.aggregate_id
      );
      if (updatedProduct && updatedProduct.version !== selectedProduct.version) {
        setSelectedProduct(updatedProduct);
      }
    }
  }, [products, selectedProduct?.aggregate_id, selectedProduct?.version]);

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setSlideOverOpen(true);
  };

  const handleSlideOverClose = () => {
    setSlideOverOpen(false);
    // Delay clearing selection to allow slide animation to complete
    setTimeout(() => setSelectedProduct(null), 300);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          {/* Header */}
          <div className="px-4 lg:px-6">
            {products && products.length > 0 && (
              <div className="flex items-center justify-end">
                <Button
                  className="gap-2"
                  onClick={() => setCreateDialogOpen(true)}
                >
                  <IconPlus className="size-4" />
                  New Product
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
                  Failed to load products: {error.message}
                </p>
              </div>
            </div>
          ) : products && products.length > 0 ? (
            <ProductList data={products} onEditProduct={handleEditProduct} />
          ) : (
            <div className="px-4 lg:px-6">
              <Empty
                title="No products yet"
                description="Get started by creating your first product"
                action={{
                  label: "Create Product",
                  onClick: () => setCreateDialogOpen(true),
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Slide-over for editing products */}
      <ProductSlideOver
        product={selectedProduct}
        open={slideOverOpen}
        onOpenChange={handleSlideOverClose}
      />

      {/* Dialog for creating products */}
      <CreateProductDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}

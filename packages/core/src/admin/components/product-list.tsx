import * as React from "react";
import type { Product } from "@/admin/hooks/use-products";
import { ProductListItem } from "@/admin/components/product-list-item";
import { Input } from "@/admin/components/ui/input";
import { IconSearch } from "@tabler/icons-react";

interface ProductListProps {
  data: Product[];
  onEditProduct: (product: Product) => void;
}

export function ProductList({ data, onEditProduct }: ProductListProps) {
  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredProducts = React.useMemo(() => {
    if (!searchQuery.trim()) return data;

    const query = searchQuery.toLowerCase();
    return data.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.slug.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query) ||
        product.vendor.toLowerCase().includes(query) ||
        product.productType.toLowerCase().includes(query)
    );
  }, [data, searchQuery]);

  return (
    <div className="flex flex-col gap-6">
      {/* Search Bar */}
      <div className="px-4 lg:px-6">
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors duration-200" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-background border-input dark:border-input hover:border-input dark:hover:border-input focus-visible:border-ring transition-all duration-200 shadow-sm"
          />
        </div>
      </div>

      {/* Products List */}
      {filteredProducts.length > 0 ? (
        filteredProducts.length === 1 ? (
          // Single product: keep original container layout
          <div className="rounded-lg border border-border/60 dark:border-border bg-card shadow-sm overflow-hidden mx-4 lg:mx-6 transition-all duration-200">
            <ProductListItem
              key={filteredProducts[0]!.aggregateId}
              product={filteredProducts[0]!}
              onEdit={() => onEditProduct(filteredProducts[0]!)}
            />
          </div>
        ) : (
          // Multiple products: individual cards with gaps
          <div className="flex flex-col gap-4 mx-4 lg:mx-6">
            {filteredProducts.map((product) => (
              <div
                key={product.aggregateId}
                className="rounded-lg border border-border/60 dark:border-border bg-card shadow-sm overflow-hidden transition-all duration-200"
              >
                <ProductListItem
                  product={product}
                  onEdit={() => onEditProduct(product)}
                />
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="rounded-lg border border-border/60 dark:border-border bg-card shadow-sm overflow-hidden mx-4 lg:mx-6 transition-all duration-200">
          <div className="flex items-center justify-center py-16 text-center">
            <div className="space-y-3 animate-in fade-in duration-300">
              <p className="text-muted-foreground text-sm md:text-base">
                {searchQuery
                  ? `No products found matching "${searchQuery}"`
                  : "No products found"}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-primary text-sm hover:underline transition-colors duration-200 font-medium cursor-pointer"
                >
                  Clear search
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

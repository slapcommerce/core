import * as React from "react";
import type { Variant } from "@/admin/hooks/use-variants";
import type { Product } from "@/admin/hooks/use-products";
import { VariantListItem } from "@/admin/components/variant-list-item";
import { Input } from "@/admin/components/ui/input";
import { IconSearch } from "@tabler/icons-react";

interface VariantListProps {
  data: Variant[];
  products: Product[];
  onEditVariant: (variant: Variant) => void;
}

export function VariantList({ data, products, onEditVariant }: VariantListProps) {
  const [searchQuery, setSearchQuery] = React.useState("");

  // Create a map for quick product lookup
  const productsMap = React.useMemo(() => {
    return new Map(products.map((p) => [p.aggregate_id, p]));
  }, [products]);

  const filteredVariants = React.useMemo(() => {
    if (!searchQuery.trim()) return data;

    const query = searchQuery.toLowerCase();
    return data.filter((variant) => {
      const product = productsMap.get(variant.product_id);
      const productTitle = product?.title.toLowerCase() || "";
      const sku = variant.sku.toLowerCase();
      const optionsString = Object.entries(variant.options)
        .map(([key, value]) => `${key}: ${value}`)
        .join(" ")
        .toLowerCase();

      return (
        productTitle.includes(query) ||
        sku.includes(query) ||
        optionsString.includes(query)
      );
    });
  }, [data, searchQuery, productsMap]);

  return (
    <div className="flex flex-col gap-6">
      {/* Search Bar */}
      <div className="px-4 lg:px-6">
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors duration-200" />
          <Input
            placeholder="Search variants by product, title, SKU, or options..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-background border-input dark:border-input hover:border-input dark:hover:border-input focus-visible:border-ring transition-all duration-200 shadow-sm"
          />
        </div>
      </div>

      {/* Variants List */}
      {filteredVariants.length > 0 ? (
        filteredVariants.length === 1 ? (
          // Single variant: keep original container layout
          <div className="rounded-lg border border-border/60 dark:border-border bg-card shadow-sm overflow-hidden mx-4 lg:mx-6 transition-all duration-200">
            <VariantListItem
              key={filteredVariants[0]!.variant_id}
              variant={filteredVariants[0]!}
              product={productsMap.get(filteredVariants[0]!.product_id)}
              onEdit={() => onEditVariant(filteredVariants[0]!)}
            />
          </div>
        ) : (
          // Multiple variants: individual cards with gaps
          <div className="flex flex-col gap-4 mx-4 lg:mx-6">
            {filteredVariants.map((variant) => (
              <div
                key={variant.variant_id}
                className="rounded-lg border border-border/60 dark:border-border bg-card shadow-sm overflow-hidden transition-all duration-200"
              >
                <VariantListItem
                  variant={variant}
                  product={productsMap.get(variant.product_id)}
                  onEdit={() => onEditVariant(variant)}
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
                  ? `No variants found matching "${searchQuery}"`
                  : "No variants found"}
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

import * as React from "react";
import type { Collection } from "@/admin/hooks/use-collections";
import { useProducts, type Product } from "@/admin/hooks/use-products";
import { Badge } from "@/admin/components/ui/badge";
import { Button } from "@/admin/components/ui/button";
import { IconPackage, IconLoader2, IconEdit } from "@tabler/icons-react";
import { Skeleton } from "@/admin/components/ui/skeleton";
import { useSheetStack } from "@/admin/components/ui/sheet-stack";
import { ProductSheetContent } from "@/admin/components/product-sheet-content";

interface CollectionProductsTabProps {
    collection: Collection;
}

export function CollectionProductsTab({ collection }: CollectionProductsTabProps) {
    const { data: products, isLoading, error } = useProducts({
        collectionId: collection.aggregate_id,
    });
    const stack = useSheetStack();

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
                    Failed to load products: {error.message}
                </p>
            </div>
        );
    }

    const handleEditProduct = (product: Product) => {
        stack.push(
            <ProductSheetContent productId={product.aggregate_id} initialProduct={product} />,
            product.title
        );
    };

    return (
        <div className="space-y-6 pb-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold">Collection Products</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        {products?.length || 0} product(s) in this collection
                    </p>
                </div>
            </div>

            {/* Products List */}
            {products && products.length > 0 ? (
                <div className="space-y-3">
                    {products.map((product) => (
                        <div
                            key={product.aggregate_id}
                            className="rounded-lg border border-border/60 p-4 space-y-2"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <IconPackage className="size-4 text-muted-foreground" />
                                    <span className="font-medium text-sm">{product.title}</span>
                                    <Badge
                                        variant={
                                            product.status === "active"
                                                ? "default"
                                                : product.status === "archived"
                                                    ? "secondary"
                                                    : "outline"
                                        }
                                        className="text-xs"
                                    >
                                        {product.status}
                                    </Badge>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditProduct(product)}
                                    className="gap-2"
                                >
                                    <IconEdit className="size-4" />
                                    Edit
                                </Button>
                            </div>

                            {product.short_description && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                    {product.short_description}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="rounded-lg border border-border/60 p-8 text-center">
                    <div className="flex flex-col items-center gap-2">
                        <IconPackage className="size-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                            No products found in this collection
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

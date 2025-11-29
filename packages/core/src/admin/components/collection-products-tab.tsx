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
import type { Collection } from "@/admin/hooks/use-collections";
import {
    useCollectionProducts,
    type CollectionProduct,
} from "@/admin/hooks/use-collection-products";
import { useReorderCollectionProducts } from "@/admin/hooks/use-reorder-collection-products";
import { useSaveStatus } from "@/admin/contexts/save-status-context";
import { IconPackage } from "@tabler/icons-react";
import { Skeleton } from "@/admin/components/ui/skeleton";
import { useSheetStack } from "@/admin/components/ui/sheet-stack";
import { ProductSheetContent } from "@/admin/components/product-sheet-content";
import { SortableProductItem } from "@/admin/components/sortable-product-item";

interface CollectionProductsTabProps {
    collection: Collection;
}

export function CollectionProductsTab({ collection }: CollectionProductsTabProps) {
    const { data: products, isLoading, error } = useCollectionProducts({
        collectionId: collection.aggregateId,
    });
    const stack = useSheetStack();
    const reorderMutation = useReorderCollectionProducts();
    const saveStatus = useSaveStatus();
    const [localProducts, setLocalProducts] = React.useState<CollectionProduct[]>([]);

    // Sync local state with fetched data
    React.useEffect(() => {
        if (products) {
            setLocalProducts(products);
        }
    }, [products]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const reorderProducts = (newOrder: CollectionProduct[]) => {
        setLocalProducts(newOrder);

        // Build positions array with new indices
        const productPositions = newOrder.map((p, index) => ({
            productId: p.productId,
            position: index,
        }));

        saveStatus.startSaving();
        reorderMutation.mutate(
            {
                collectionId: collection.aggregateId,
                productPositions,
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
            const oldIndex = localProducts.findIndex((p) => p.productId === active.id);
            const newIndex = localProducts.findIndex((p) => p.productId === over.id);
            const newOrder = arrayMove(localProducts, oldIndex, newIndex);
            reorderProducts(newOrder);
        }
    };

    const handleMoveToTop = (productId: string) => {
        const index = localProducts.findIndex((p) => p.productId === productId);
        if (index > 0) {
            const newOrder = arrayMove(localProducts, index, 0);
            reorderProducts(newOrder);
        }
    };

    const handleMoveToBottom = (productId: string) => {
        const index = localProducts.findIndex((p) => p.productId === productId);
        if (index < localProducts.length - 1) {
            const newOrder = arrayMove(localProducts, index, localProducts.length - 1);
            reorderProducts(newOrder);
        }
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
                    Failed to load products: {error.message}
                </p>
            </div>
        );
    }

    const handleEditProduct = (product: CollectionProduct) => {
        stack.push(
            <ProductSheetContent productId={product.productId} />,
            product.name
        );
    };

    return (
        <div className="space-y-6 pb-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold">Collection Products</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        {localProducts.length} product(s) in this collection
                        {localProducts.length > 1 && " - drag to reorder"}
                    </p>
                </div>
            </div>

            {/* Products List */}
            {localProducts.length > 0 ? (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={localProducts.map((p) => p.productId)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="space-y-3">
                            {localProducts.map((product, index) => (
                                <SortableProductItem
                                    key={product.productId}
                                    product={product}
                                    position={index}
                                    isFirst={index === 0}
                                    isLast={index === localProducts.length - 1}
                                    onEdit={() => handleEditProduct(product)}
                                    onMoveToTop={() => handleMoveToTop(product.productId)}
                                    onMoveToBottom={() => handleMoveToBottom(product.productId)}
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
                            No products found in this collection
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

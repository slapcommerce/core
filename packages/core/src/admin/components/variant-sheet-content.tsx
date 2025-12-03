import * as React from "react";
import { useVariants, type Variant } from "@/admin/hooks/use-variants";
import { useProducts, type Product } from "@/admin/hooks/use-products";
import { Tabs, TabsList, TabsTrigger } from "@/admin/components/ui/tabs";
import { Badge } from "@/admin/components/ui/badge";
import { Skeleton } from "@/admin/components/ui/skeleton";
import { SaveStatusIndicator } from "@/admin/components/save-status-indicator";
import { VariantDetailsTab } from "@/admin/components/variant-details-tab";
import { VariantSchedulingTab } from "@/admin/components/variant-scheduling-tab";
import { VariantImagesTab } from "@/admin/components/variant-images-tab";

interface VariantSheetContentProps {
    variantId: string;
    initialVariant?: Variant;
}

type TabConfig = {
    id: string;
    label: string;
    component: React.ComponentType<{ variant: Variant; product: Product }>;
};

export function VariantSheetContent({ variantId, initialVariant }: VariantSheetContentProps) {
    const [activeTab, setActiveTab] = React.useState("details");

    // Fetch variant data by ID - this will automatically update when the cache is invalidated
    const { data: variants, isLoading: variantsLoading } = useVariants();
    const variant = React.useMemo(
        () => variants?.find((v) => v.aggregateId === variantId) || initialVariant,
        [variants, variantId, initialVariant]
    );

    // Fetch product to get variant options definition and fulfillment type
    const { data: products } = useProducts();
    const product = React.useMemo(
        () => products?.find((p) => p.aggregateId === variant?.productId),
        [products, variant?.productId]
    );

    // Build tabs - always the same for variants
    const tabs = React.useMemo<TabConfig[]>(() => {
        return [
            { id: "details", label: "Details", component: VariantDetailsTab },
            { id: "scheduling", label: "Scheduling", component: VariantSchedulingTab },
            { id: "images", label: "Images", component: VariantImagesTab },
        ];
    }, []);

    // Reset tab when variant changes
    React.useEffect(() => {
        if (variant) {
            setActiveTab("details");
        }
    }, [variant?.aggregateId]);

    if ((variantsLoading && !variant) || !variant || !product) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
            </div>
        );
    }

    return (
        <>
            <div className="flex items-center justify-between gap-4 pb-4">
                <div className="flex gap-2">
                    <Badge variant="secondary" className="text-xs">
                        SKU: {variant.sku}
                    </Badge>
                    <Badge
                        variant={
                            variant.status === "active"
                                ? "default"
                                : variant.status === "archived"
                                    ? "secondary"
                                    : "outline"
                        }
                    >
                        {variant.status}
                    </Badge>
                </div>
                <SaveStatusIndicator />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full mb-6" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
                    {tabs.map((tab) => (
                        <TabsTrigger key={tab.id} value={tab.id}>
                            {tab.label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {tabs.map((tab) => (
                    <div key={tab.id} style={{ display: activeTab === tab.id ? "block" : "none" }}>
                        <tab.component variant={variant} product={product} />
                    </div>
                ))}
            </Tabs>
        </>
    );
}

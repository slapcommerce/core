import * as React from "react";
import { useProducts, type Product } from "@/admin/hooks/use-products";
import { Tabs, TabsList, TabsTrigger } from "@/admin/components/ui/tabs";
import { ProductOverviewTab } from "@/admin/components/product-overview-tab";
import { ProductVariantsTab } from "@/admin/components/product-variants-tab";
import { ProductSchedulingTab } from "@/admin/components/product-scheduling-tab";
import { ProductFulfillmentTab } from "@/admin/components/product-fulfillment-tab";
import { ProductDownloadsTab } from "@/admin/components/product-downloads-tab";
import { ProductSeoTab } from "@/admin/components/product-seo-tab";
import { SaveStatusIndicator } from "@/admin/components/save-status-indicator";
import { Skeleton } from "@/admin/components/ui/skeleton";

interface ProductSheetContentProps {
    productId: string;
    initialProduct?: Product;
}

type TabConfig = {
    id: string;
    label: string;
    component: React.ComponentType<{ product: Product }>;
};

export function ProductSheetContent({ productId, initialProduct }: ProductSheetContentProps) {
    const [activeTab, setActiveTab] = React.useState("overview");

    // Fetch product data by ID - this will automatically update when the cache is invalidated
    const { data: products, isLoading } = useProducts();
    const product = React.useMemo(
        () => products?.find((p) => p.aggregateId === productId) || initialProduct,
        [products, productId, initialProduct]
    );

    // Build tabs based on product type
    const tabs = React.useMemo<TabConfig[]>(() => {
        if (!product) return [];

        const baseTabs: TabConfig[] = [
            { id: "overview", label: "Overview", component: ProductOverviewTab },
            { id: "variants", label: "Variants", component: ProductVariantsTab },
            { id: "scheduling", label: "Scheduling", component: ProductSchedulingTab },
        ];

        // Add type-specific tabs
        if (product.productType === "dropship") {
            baseTabs.push({ id: "fulfillment", label: "Fulfillment", component: ProductFulfillmentTab });
        } else {
            baseTabs.push({ id: "downloads", label: "Downloads", component: ProductDownloadsTab });
        }

        // SEO is always last
        baseTabs.push({ id: "seo", label: "SEO", component: ProductSeoTab });

        return baseTabs;
    }, [product?.productType]);

    // Reset tab when product changes
    React.useEffect(() => {
        if (product) {
            setActiveTab("overview");
        }
    }, [product?.aggregateId]);

    // Ensure activeTab is valid when tabs change
    React.useEffect(() => {
        if (tabs.length > 0 && !tabs.find(t => t.id === activeTab)) {
            setActiveTab("overview");
        }
    }, [tabs, activeTab]);

    if ((isLoading && !product) || !product) {
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
            <div className="fixed top-4 right-16 z-50">
                <SaveStatusIndicator />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className={`grid w-full mb-6`} style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
                    {tabs.map((tab) => (
                        <TabsTrigger key={tab.id} value={tab.id}>
                            {tab.label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {tabs.map((tab) => (
                    <div key={tab.id} style={{ display: activeTab === tab.id ? "block" : "none" }}>
                        <tab.component product={product} />
                    </div>
                ))}
            </Tabs>
        </>
    );
}

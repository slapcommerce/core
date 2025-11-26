import * as React from "react";
import { useProducts, type Product } from "@/admin/hooks/use-products";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/admin/components/ui/tabs";
import { ProductOverviewTab } from "@/admin/components/product-overview-tab";
import { ProductVariantsTab } from "@/admin/components/product-variants-tab";
import { ProductSeoTab } from "@/admin/components/product-seo-tab";
import { SaveStatusIndicator } from "@/admin/components/save-status-indicator";
import { Skeleton } from "@/admin/components/ui/skeleton";

interface ProductSheetContentProps {
    productId: string;
    initialProduct?: Product;
}

export function ProductSheetContent({ productId, initialProduct }: ProductSheetContentProps) {
    const [activeTab, setActiveTab] = React.useState("overview");

    // Fetch product data by ID - this will automatically update when the cache is invalidated
    const { data: products, isLoading } = useProducts();
    const product = React.useMemo(
        () => products?.find((p) => p.aggregateId === productId) || initialProduct,
        [products, productId, initialProduct]
    );

    // Reset tab when product changes
    React.useEffect(() => {
        if (product) {
            setActiveTab("overview");
        }
    }, [product?.aggregateId]);

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
                <TabsList className="grid w-full grid-cols-3 mb-6">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="variants">Variants</TabsTrigger>
                    <TabsTrigger value="seo">SEO</TabsTrigger>
                </TabsList>

                <div style={{ display: activeTab === "overview" ? "block" : "none" }}>
                    <ProductOverviewTab product={product} />
                </div>

                <div style={{ display: activeTab === "variants" ? "block" : "none" }}>
                    <ProductVariantsTab product={product} />
                </div>

                <div style={{ display: activeTab === "seo" ? "block" : "none" }}>
                    <ProductSeoTab product={product} />
                </div>
            </Tabs>
        </>
    );
}

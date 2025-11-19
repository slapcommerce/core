import * as React from "react";
import { useProducts } from "@/hooks/use-products";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductOverviewTab } from "@/components/product-overview-tab";
import { ProductVariantsTab } from "@/components/product-variants-tab";
import { ProductSeoTab } from "@/components/product-seo-tab";
import { SaveStatusIndicator } from "@/components/save-status-indicator";
import { Skeleton } from "@/components/ui/skeleton";

interface ProductSheetContentProps {
    productId: string;
}

export function ProductSheetContent({ productId }: ProductSheetContentProps) {
    const [activeTab, setActiveTab] = React.useState("overview");

    // Fetch product data by ID - this will automatically update when the cache is invalidated
    const { data: products, isLoading } = useProducts();
    const product = React.useMemo(
        () => products?.find((p) => p.aggregate_id === productId),
        [products, productId]
    );

    // Reset tab when product changes
    React.useEffect(() => {
        if (product) {
            setActiveTab("overview");
        }
    }, [product?.aggregate_id]);

    if (isLoading || !product) {
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
            <div className="flex items-center justify-end pb-4">
                <SaveStatusIndicator />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="variants">Variants</TabsTrigger>
                    <TabsTrigger value="seo">SEO</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                    <ProductOverviewTab product={product} />
                </TabsContent>

                <TabsContent value="variants" className="space-y-6">
                    <ProductVariantsTab product={product} />
                </TabsContent>

                <TabsContent value="seo" className="space-y-6">
                    <ProductSeoTab product={product} />
                </TabsContent>
            </Tabs>
        </>
    );
}

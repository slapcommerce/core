import * as React from "react";
import type { Collection } from "@/hooks/use-collections";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CollectionOverviewTab } from "@/components/collection-overview-tab";
import { CollectionImagesTab } from "@/components/collection-images-tab";
import { CollectionSeoTab } from "@/components/collection-seo-tab";
import { CollectionProductsTab } from "@/components/collection-products-tab";
import { SaveStatusIndicator } from "@/components/save-status-indicator";

interface CollectionSheetContentProps {
    collection: Collection;
}

export function CollectionSheetContent({ collection }: CollectionSheetContentProps) {
    const [activeTab, setActiveTab] = React.useState("overview");

    // Reset tab when collection changes
    React.useEffect(() => {
        if (collection) {
            setActiveTab("overview");
        }
    }, [collection?.aggregate_id]);

    return (
        <>
            <div className="flex items-center justify-end pb-4">
                <SaveStatusIndicator />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-6">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="products">Products</TabsTrigger>
                    <TabsTrigger value="images">Images</TabsTrigger>
                    <TabsTrigger value="seo">SEO</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                    <CollectionOverviewTab collection={collection} />
                </TabsContent>

                <TabsContent value="products" className="space-y-6">
                    <CollectionProductsTab collection={collection} />
                </TabsContent>

                <TabsContent value="images" className="space-y-6">
                    <CollectionImagesTab collection={collection} />
                </TabsContent>

                <TabsContent value="seo" className="space-y-6">
                    <CollectionSeoTab collection={collection} />
                </TabsContent>
            </Tabs>
        </>
    );
}

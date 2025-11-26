import * as React from "react";
import type { Collection } from "@/admin/hooks/use-collections";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/admin/components/ui/tabs";
import { CollectionOverviewTab } from "@/admin/components/collection-overview-tab";
import { CollectionImagesTab } from "@/admin/components/collection-images-tab";
import { CollectionSeoTab } from "@/admin/components/collection-seo-tab";
import { CollectionProductsTab } from "@/admin/components/collection-products-tab";
import { SaveStatusIndicator } from "@/admin/components/save-status-indicator";

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
    }, [collection?.aggregateId]);

    return (
        <>
            <div className="fixed top-4 right-16 z-50">
                <SaveStatusIndicator />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-6">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="products">Products</TabsTrigger>
                    <TabsTrigger value="images">Images</TabsTrigger>
                    <TabsTrigger value="seo">SEO</TabsTrigger>
                </TabsList>

                <div style={{ display: activeTab === "overview" ? "block" : "none" }}>
                    <CollectionOverviewTab collection={collection} />
                </div>

                <div style={{ display: activeTab === "products" ? "block" : "none" }}>
                    <CollectionProductsTab collection={collection} />
                </div>

                <div style={{ display: activeTab === "images" ? "block" : "none" }}>
                    <CollectionImagesTab collection={collection} />
                </div>

                <div style={{ display: activeTab === "seo" ? "block" : "none" }}>
                    <CollectionSeoTab collection={collection} />
                </div>
            </Tabs>
        </>
    );
}

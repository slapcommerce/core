import * as React from "react";
import type { Collection } from "@/hooks/use-collections";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CollectionOverviewTab } from "@/components/collection-overview-tab";
import { CollectionImagesTab } from "@/components/collection-images-tab";
import { CollectionSeoTab } from "@/components/collection-seo-tab";
import { SaveStatusIndicator } from "@/components/save-status-indicator";

interface CollectionSlideOverProps {
  collection: Collection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CollectionSlideOver({
  collection,
  open,
  onOpenChange,
}: CollectionSlideOverProps) {
  const [activeTab, setActiveTab] = React.useState("overview");

  // Reset tab when collection changes
  React.useEffect(() => {
    if (collection) {
      setActiveTab("overview");
    }
  }, [collection?.aggregate_id]);

  if (!collection) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full sm:max-w-2xl lg:max-w-4xl overflow-y-auto px-4"
        side="right"
      >
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between gap-4">
            <SheetTitle className="text-xl">{collection.title}</SheetTitle>
            <SaveStatusIndicator />
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="images">Images</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <CollectionOverviewTab collection={collection} />
          </TabsContent>

          <TabsContent value="images" className="space-y-6">
            <CollectionImagesTab collection={collection} />
          </TabsContent>

          <TabsContent value="seo" className="space-y-6">
            <CollectionSeoTab collection={collection} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

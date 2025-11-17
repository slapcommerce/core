import * as React from "react";
import type { Product } from "@/hooks/use-products";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductOverviewTab } from "@/components/product-overview-tab";
import { ProductVariantsTab } from "@/components/product-variants-tab";
import { ProductSeoTab } from "@/components/product-seo-tab";

interface ProductSlideOverProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductSlideOver({
  product,
  open,
  onOpenChange,
}: ProductSlideOverProps) {
  const [activeTab, setActiveTab] = React.useState("overview");

  // Reset tab when product changes
  React.useEffect(() => {
    if (product) {
      setActiveTab("overview");
    }
  }, [product?.aggregate_id]);

  if (!product) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full sm:max-w-2xl lg:max-w-4xl overflow-y-auto px-4"
        side="right"
      >
        <SheetHeader className="pb-4">
          <SheetTitle className="text-xl">{product.title}</SheetTitle>
        </SheetHeader>

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
      </SheetContent>
    </Sheet>
  );
}

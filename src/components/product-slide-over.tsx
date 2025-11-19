import * as React from "react";
import type { Product } from "@/hooks/use-products";
import { SheetStack } from "@/components/ui/sheet-stack";
import { ProductSheetContent } from "@/components/product-sheet-content";

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
  if (!product) {
    return null;
  }

  return (
    <SheetStack
      open={open}
      onOpenChange={onOpenChange}
      initialContent={<ProductSheetContent productId={product.aggregate_id} />}
      initialTitle={product.title}
    />
  );
}

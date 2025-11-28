import * as React from "react";
import type { Product } from "@/admin/hooks/use-products";
import { SheetStack } from "@/admin/components/ui/sheet-stack";
import { ProductSheetContent } from "@/admin/components/product-sheet-content";

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
      initialContent={<ProductSheetContent productId={product.aggregateId} initialProduct={product} />}
      initialTitle={product.name}
    />
  );
}

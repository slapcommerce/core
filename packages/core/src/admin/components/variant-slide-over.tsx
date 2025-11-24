import * as React from "react";
import type { Variant } from "@/admin/hooks/use-variants";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/admin/components/ui/sheet";
import { VariantSheetContent } from "@/admin/components/variant-sheet-content";
import { SaveStatusIndicator } from "@/admin/components/save-status-indicator";

interface VariantSlideOverProps {
  variant: Variant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VariantSlideOver({
  variant,
  open,
  onOpenChange,
}: VariantSlideOverProps) {
  if (!variant) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full sm:max-w-2xl lg:max-w-4xl overflow-y-auto px-4"
        side="right"
      >
        <div className="fixed top-4 right-16 z-50">
          <SaveStatusIndicator />
        </div>
        <SheetHeader className="pb-4">
          <SheetTitle className="text-xl">Variant {variant.sku}</SheetTitle>
        </SheetHeader>
        <VariantSheetContent variantId={variant.aggregate_id} initialVariant={variant} />
      </SheetContent>
    </Sheet>
  );
}

import * as React from "react";
import type { Variant } from "@/hooks/use-variants";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { VariantSheetContent } from "@/components/variant-sheet-content";
import { SaveStatusIndicator } from "@/components/save-status-indicator";

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
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between gap-4">
            <SheetTitle className="text-xl">Variant {variant.sku}</SheetTitle>
            <SaveStatusIndicator />
          </div>
        </SheetHeader>
        <VariantSheetContent variantId={variant.aggregate_id} initialVariant={variant} />
      </SheetContent>
    </Sheet>
  );
}

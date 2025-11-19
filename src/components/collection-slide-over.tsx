import * as React from "react";
import type { Collection } from "@/hooks/use-collections";
import { SheetStack } from "@/components/ui/sheet-stack";
import { CollectionSheetContent } from "@/components/collection-sheet-content";

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
  if (!collection) {
    return null;
  }

  return (
    <SheetStack
      open={open}
      onOpenChange={onOpenChange}
      initialContent={<CollectionSheetContent collection={collection} />}
      initialTitle={collection.title}
    />
  );
}

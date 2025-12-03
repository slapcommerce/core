import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ProductVariant } from "@/admin/hooks/use-product-variants";
import { Badge } from "@/admin/components/ui/badge";
import { Button } from "@/admin/components/ui/button";
import { IconGripVertical, IconPackage, IconEdit, IconCrown, IconArrowBarToUp, IconArrowBarToDown } from "@tabler/icons-react";
import { cn } from "@/admin/lib/utils";

interface SortableVariantItemProps {
  variant: ProductVariant;
  position: number;
  isDefault: boolean;
  isFirst: boolean;
  isLast: boolean;
  displayName: string;
  onEdit: () => void;
  onSetDefault: () => void;
  onMoveToTop: () => void;
  onMoveToBottom: () => void;
}

export function SortableVariantItem({
  variant,
  position,
  isDefault,
  isFirst,
  isLast,
  displayName,
  onEdit,
  onSetDefault,
  onMoveToTop,
  onMoveToBottom,
}: SortableVariantItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: variant.variantId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border border-border/60 p-4 space-y-2 bg-background",
        isDragging && "opacity-50 border-primary ring-2 ring-primary/20"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="p-1 cursor-grab active:cursor-grabbing hover:bg-muted rounded touch-none"
            aria-label="Drag to reorder"
          >
            <IconGripVertical className="size-4 text-muted-foreground" />
          </button>

          {/* Position badge */}
          <span className="bg-muted/50 px-2 py-0.5 rounded text-xs font-mono tabular-nums text-muted-foreground">
            #{position + 1}
          </span>

          {/* Default variant crown */}
          <button
            onClick={onSetDefault}
            disabled={isDefault}
            className={cn(
              "p-1 rounded transition-colors",
              isDefault
                ? "text-amber-500 cursor-default"
                : "text-muted-foreground hover:text-amber-500 hover:bg-muted cursor-pointer"
            )}
            title={isDefault ? "Default variant" : "Set as default variant"}
            aria-label={isDefault ? "Default variant" : "Set as default variant"}
          >
            <IconCrown
              className="size-4"
              fill={isDefault ? "currentColor" : "none"}
            />
          </button>

          {/* Variant info */}
          <IconPackage className="size-4 text-muted-foreground" />
          <span className="font-medium text-sm">{displayName}</span>
          <Badge
            variant={
              variant.variantStatus === "active"
                ? "default"
                : variant.variantStatus === "archived"
                  ? "secondary"
                  : "outline"
            }
            className="text-xs"
          >
            {variant.variantStatus}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onMoveToTop}
            disabled={isFirst}
            title="Move to top"
          >
            <IconArrowBarToUp className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onMoveToBottom}
            disabled={isLast}
            title="Move to bottom"
          >
            <IconArrowBarToDown className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="gap-2"
          >
            <IconEdit className="size-4" />
            Edit
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pl-[108px]">
        <span>
          <span className="font-medium">SKU:</span> {variant.sku}
        </span>
        <span>
          <span className="font-medium">Price:</span> ${variant.activePrice.toFixed(2)}
        </span>
        <span>
          <span className="font-medium">Inventory:</span> {variant.inventory}
        </span>
      </div>
    </div>
  );
}

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CollectionProduct } from "@/admin/hooks/use-collection-products";
import { Badge } from "@/admin/components/ui/badge";
import { Button } from "@/admin/components/ui/button";
import { IconGripVertical, IconPackage, IconEdit, IconArrowBarToUp, IconArrowBarToDown } from "@tabler/icons-react";
import { cn } from "@/admin/lib/utils";

interface SortableProductItemProps {
  product: CollectionProduct;
  position: number;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onMoveToTop: () => void;
  onMoveToBottom: () => void;
}

export function SortableProductItem({
  product,
  position,
  isFirst,
  isLast,
  onEdit,
  onMoveToTop,
  onMoveToBottom,
}: SortableProductItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.productId });

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

          {/* Product info */}
          <IconPackage className="size-4 text-muted-foreground" />
          <span className="font-medium text-sm">{product.name}</span>
          <Badge
            variant={
              product.status === "active"
                ? "default"
                : product.status === "archived"
                  ? "secondary"
                  : "outline"
            }
            className="text-xs"
          >
            {product.status}
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

      {product.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 pl-[72px]">
          {product.description}
        </p>
      )}
    </div>
  );
}

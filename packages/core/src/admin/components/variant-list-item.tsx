import * as React from "react";
import { useState } from "react";
import type { Variant } from "@/admin/hooks/use-variants";
import type { Product } from "@/admin/hooks/use-products";
import {
  usePublishVariant,
  useArchiveVariant,
} from "@/admin/hooks/use-variants";
import { Badge } from "@/admin/components/ui/badge";
import { Button } from "@/admin/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/admin/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/admin/components/ui/dialog";
import {
  IconEdit,
  IconDots,
  IconWorld,
  IconArchive,
  IconPhoto,
  IconPackage,
} from "@tabler/icons-react";
import { ResponsiveImage } from "@/admin/components/responsive-image";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { authClient } from "@/admin/lib/auth-client";

interface VariantListItemProps {
  variant: Variant;
  product?: Product;
  onEdit: () => void;
}

export function VariantListItem({ variant, product, onEdit }: VariantListItemProps) {
  // Safety check
  if (!variant) {
    return null;
  }

  const { data: session } = authClient.useSession();
  const publishMutation = usePublishVariant();
  const archiveMutation = useArchiveVariant();

  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);

  const isArchived = variant.status === "archived";
  const isDraft = variant.status === "draft";
  const isActive = variant.status === "active";

  const primaryImage = variant.images && variant.images.length > 0 ? variant.images[0] : null;

  // Compute display name: {productName} - {comma-separated option values} or {productName} - primary
  const displayName = product
    ? `${product.title} - ${Object.keys(variant.options).length > 0 ? Object.values(variant.options).join(', ') : 'primary'}`
    : variant.sku;

  // Handler functions
  const handlePublish = async () => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to publish variants");
      return;
    }

    try {
      await publishMutation.mutateAsync({
        id: variant.variant_id,
        userId: session.user.id,
        expectedVersion: variant.version,
      });
      toast.success("Variant published successfully");
      setShowPublishDialog(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to publish variant"
      );
    }
  };

  const handleArchive = async () => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to archive variants");
      return;
    }

    try {
      await archiveMutation.mutateAsync({
        id: variant.variant_id,
        userId: session.user.id,
        expectedVersion: variant.version,
      });
      toast.success("Variant archived successfully");
      setShowArchiveDialog(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to archive variant"
      );
    }
  };

  return (
    <>
      <div className="p-4 lg:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Image + Variant Info */}
          <div className="flex gap-4 flex-1 min-w-0">
            {/* Image */}
            <div className="shrink-0">
              {primaryImage ? (
                <ResponsiveImage
                  imageUrls={primaryImage.urls}
                  alt={primaryImage.altText || displayName}
                  className="size-16 lg:size-20 rounded-lg object-cover border-2 border-border"
                  sizePreset="thumbnail"
                  sizes="80px"
                />
              ) : (
                <div className="size-16 lg:size-20 rounded-lg bg-muted border-2 border-dashed border-border flex items-center justify-center">
                  <IconPhoto className="size-6 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Variant Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                {product && (
                  <Link
                    to="/admin/products"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {product.title}
                  </Link>
                )}
                <h3 className="font-semibold text-base lg:text-lg truncate">
                  {displayName}
                </h3>
                <Badge
                  variant={
                    variant.status === "active"
                      ? "default"
                      : variant.status === "archived"
                      ? "secondary"
                      : "outline"
                  }
                >
                  {variant.status}
                </Badge>
              </div>

              <div className="space-y-2">
                {/* Options badges */}
                {Object.keys(variant.options).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(variant.options).map(([key, value]) => (
                      <Badge key={key} variant="secondary" className="text-xs">
                        {key}: {value}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Core details */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="font-medium">SKU:</span> {variant.sku}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="font-medium">Price:</span> ${variant.price.toFixed(2)}
                  </span>
                  <span className="flex items-center gap-1">
                    <IconPackage className="size-3" />
                    <span className="font-medium">Inventory:</span> {variant.inventory}
                  </span>
                  {variant.images.length > 0 && (
                    <span className="flex items-center gap-1">
                      <IconPhoto className="size-3" />
                      <span className="font-medium">Images:</span> {variant.images.length}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="gap-2"
            >
              <IconEdit className="size-4" />
              Edit Details
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="size-8 p-0">
                  <IconDots className="size-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* Publish Actions */}
                {isDraft && (
                  <DropdownMenuItem
                    onClick={() => setShowPublishDialog(true)}
                    disabled={publishMutation.isPending}
                  >
                    <IconWorld className="size-4 mr-2" />
                    Publish Now
                  </DropdownMenuItem>
                )}

                {/* Archive Actions */}
                {!isArchived && (
                  <DropdownMenuItem
                    onClick={() => setShowArchiveDialog(true)}
                    disabled={archiveMutation.isPending}
                  >
                    <IconArchive className="size-4 mr-2" />
                    Archive Now
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Dialogs for immediate actions */}
      <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish Variant</DialogTitle>
            <DialogDescription>
              Are you sure you want to publish "{variant.productId + "-" + variant.sku}"? This will make
              it available for purchase.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPublishDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handlePublish} disabled={publishMutation.isPending}>
              {publishMutation.isPending ? "Publishing..." : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Variant</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive "{variant.productId + "-" + variant.sku}"? Archived
              variants are hidden from all listings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowArchiveDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleArchive}
              disabled={archiveMutation.isPending}
              variant="destructive"
            >
              {archiveMutation.isPending ? "Archiving..." : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

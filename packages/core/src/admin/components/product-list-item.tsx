import * as React from "react";
import { useState } from "react";
import type { Product } from "@/admin/hooks/use-products";
import {
  usePublishProduct,
  useUnpublishProduct,
  useArchiveProduct,
} from "@/admin/hooks/use-products";
import { Badge } from "@/admin/components/ui/badge";
import { Button } from "@/admin/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  IconEyeOff,
  IconArchive,
  IconPackage,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { authClient } from "@/admin/lib/auth-client";

interface ProductListItemProps {
  product: Product;
  onEdit: () => void;
}

export function ProductListItem({ product, onEdit }: ProductListItemProps) {
  // Safety check
  if (!product) {
    return null;
  }

  const { data: session } = authClient.useSession();
  const publishMutation = usePublishProduct();
  const unpublishMutation = useUnpublishProduct();
  const archiveMutation = useArchiveProduct();

  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showUnpublishDialog, setShowUnpublishDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);

  const isArchived = product.status === "archived";
  const isDraft = product.status === "draft";
  const isActive = product.status === "active";

  // Handler functions
  const handlePublish = async () => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to publish products");
      return;
    }

    try {
      await publishMutation.mutateAsync({
        id: product.aggregateId,
        userId: session.user.id,
        expectedVersion: product.version,
      });
      toast.success("Product published successfully");
      setShowPublishDialog(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to publish product"
      );
    }
  };

  const handleUnpublish = async () => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to unpublish products");
      return;
    }

    try {
      await unpublishMutation.mutateAsync({
        id: product.aggregateId,
        userId: session.user.id,
        expectedVersion: product.version,
      });
      toast.success("Product unpublished successfully");
      setShowUnpublishDialog(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to unpublish product"
      );
    }
  };

  const handleArchive = async () => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to archive products");
      return;
    }

    try {
      await archiveMutation.mutateAsync({
        id: product.aggregateId,
        userId: session.user.id,
        expectedVersion: product.version,
      });
      toast.success("Product archived successfully");
      setShowArchiveDialog(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to archive product"
      );
    }
  };

  return (
    <>
      <div className="p-4 lg:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Product Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-semibold text-base lg:text-lg truncate">
                {product.name}
              </h3>
              <Badge
                variant={
                  product.status === "active"
                    ? "default"
                    : product.status === "archived"
                    ? "secondary"
                    : "outline"
                }
              >
                {product.status}
              </Badge>
            </div>

            <div className="space-y-1">
              {product.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {product.description}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {product.vendor && (
                  <span className="flex items-center gap-1">
                    <span className="font-medium">Vendor:</span> {product.vendor}
                  </span>
                )}
                {product.product_type && (
                  <span className="flex items-center gap-1">
                    <span className="font-medium">Type:</span>{" "}
                    {product.product_type}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <IconPackage className="size-3" />
                  <span className="font-medium">Collections:</span>{" "}
                  {product.collections.length}
                </span>
              </div>

              {product.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {product.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
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

                {/* Unpublish Actions */}
                {isActive && (
                  <DropdownMenuItem
                    onClick={() => setShowUnpublishDialog(true)}
                    disabled={unpublishMutation.isPending}
                  >
                    <IconEyeOff className="size-4 mr-2" />
                    Unpublish Now
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

                {/* Manage Variants */}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href={`/admin/products/variants?productId=${product.aggregateId}`}>
                    <IconPackage className="size-4 mr-2" />
                    Manage Variants
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Dialogs for immediate actions */}
      <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to publish "{product.name}"? This will make
              it visible to customers.
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

      <Dialog
        open={showUnpublishDialog}
        onOpenChange={setShowUnpublishDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unpublish Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to unpublish "{product.name}"? This will
              hide it from customers.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowUnpublishDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUnpublish}
              disabled={unpublishMutation.isPending}
            >
              {unpublishMutation.isPending ? "Unpublishing..." : "Unpublish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive "{product.name}"? Archived
              products are hidden from all listings.
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

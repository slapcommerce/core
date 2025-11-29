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
  IconClock,
  IconDots,
  IconWorld,
  IconEyeOff,
  IconArchive,
  IconCalendar,
  IconPackage,
} from "@tabler/icons-react";
import { useProductSchedules } from "@/admin/hooks/use-schedules";
import { format } from "date-fns";
import { toast } from "sonner";
import { ScheduleActionDialog } from "@/admin/components/schedule-action-dialog";
import { ProductSchedulesDialog } from "@/admin/components/product-schedules-dialog";
import { authClient } from "@/admin/lib/auth-client";

interface ProductListItemProps {
  product: Product;
  onEdit: () => void;
}

// Helper to get action label and color
const ACTION_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  publishProduct: {
    label: "Publishes",
    color: "text-zen-moss",
    bgColor: "bg-zen-moss/10",
  },
  unpublishProduct: {
    label: "Unpublishes",
    color: "text-punk-orange",
    bgColor: "bg-punk-orange/10",
  },
  archiveProduct: {
    label: "Archives",
    color: "text-punk-red",
    bgColor: "bg-punk-red/10",
  },
};

export function ProductListItem({ product, onEdit }: ProductListItemProps) {
  // Safety check
  if (!product) {
    return null;
  }

  const { data: session } = authClient.useSession();
  const { data: schedules } = useProductSchedules(product.aggregateId);
  const publishMutation = usePublishProduct();
  const unpublishMutation = useUnpublishProduct();
  const archiveMutation = useArchiveProduct();

  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showUnpublishDialog, setShowUnpublishDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showSchedulePublishDialog, setShowSchedulePublishDialog] =
    useState(false);
  const [showScheduleUnpublishDialog, setShowScheduleUnpublishDialog] =
    useState(false);
  const [showScheduleArchiveDialog, setShowScheduleArchiveDialog] =
    useState(false);
  const [showSchedulesDialog, setShowSchedulesDialog] = useState(false);

  const isArchived = product.status === "archived";
  const isDraft = product.status === "draft";
  const isActive = product.status === "active";

  const pendingSchedules =
    schedules?.filter((s) => s.status === "pending") || [];

  // Check if there's a pending publish schedule
  const hasPendingPublish = pendingSchedules.some(
    (s) => s.command_type === "publishProduct"
  );

  // Check if there's a pending unpublish schedule
  const hasPendingUnpublish = pendingSchedules.some(
    (s) => s.command_type === "unpublishProduct"
  );

  // Check if there's a pending archive schedule
  const hasPendingArchive = pendingSchedules.some(
    (s) => s.command_type === "archiveProduct"
  );

  // Get the next scheduled action (earliest pending schedule)
  const nextSchedule = pendingSchedules.sort(
    (a, b) =>
      new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime()
  )[0];

  // Get the action configuration for the next schedule
  const nextActionConfig = nextSchedule
    ? ACTION_CONFIG[nextSchedule.command_type]
    : null;

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

              {/* Schedule indicator - show next scheduled action */}
              {nextSchedule && nextActionConfig && (
                <Badge
                  variant="outline"
                  className={`gap-1 cursor-pointer hover:opacity-80 transition-opacity ${nextActionConfig.bgColor} ${nextActionConfig.color} border-none`}
                  onClick={() => setShowSchedulesDialog(true)}
                >
                  <IconClock className="size-3" />
                  {nextActionConfig.label}{" "}
                  {format(new Date(nextSchedule.scheduled_for), "MMM d, h:mm a")}
                </Badge>
              )}
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
                  <>
                    <DropdownMenuItem
                      onClick={() => setShowPublishDialog(true)}
                      disabled={publishMutation.isPending || hasPendingPublish}
                    >
                      <IconWorld className="size-4 mr-2" />
                      Publish Now
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setShowSchedulePublishDialog(true)}
                      disabled={hasPendingPublish}
                    >
                      <IconCalendar className="size-4 mr-2" />
                      Schedule Publish
                    </DropdownMenuItem>
                  </>
                )}

                {/* Unpublish Actions */}
                {isActive && (
                  <>
                    <DropdownMenuItem
                      onClick={() => setShowUnpublishDialog(true)}
                      disabled={
                        unpublishMutation.isPending || hasPendingUnpublish
                      }
                    >
                      <IconEyeOff className="size-4 mr-2" />
                      Unpublish Now
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setShowScheduleUnpublishDialog(true)}
                      disabled={hasPendingUnpublish}
                    >
                      <IconCalendar className="size-4 mr-2" />
                      Schedule Unpublish
                    </DropdownMenuItem>
                  </>
                )}

                {/* Archive Actions */}
                {!isArchived && (
                  <>
                    <DropdownMenuItem
                      onClick={() => setShowArchiveDialog(true)}
                      disabled={archiveMutation.isPending || hasPendingArchive}
                    >
                      <IconArchive className="size-4 mr-2" />
                      Archive Now
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setShowScheduleArchiveDialog(true)}
                      disabled={hasPendingArchive}
                    >
                      <IconCalendar className="size-4 mr-2" />
                      Schedule Archive
                    </DropdownMenuItem>
                  </>
                )}

                {/* Manage Variants */}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href={`/admin/products/variants?productId=${product.aggregateId}`}>
                    <IconPackage className="size-4 mr-2" />
                    Manage Variants
                  </a>
                </DropdownMenuItem>

                {/* Scheduled Actions */}
                {pendingSchedules.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setShowSchedulesDialog(true)}
                    >
                      <IconClock className="size-4 mr-2" />
                      View Schedules ({pendingSchedules.length})
                    </DropdownMenuItem>
                  </>
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

      {/* Schedule Dialogs */}
      <ScheduleActionDialog
        open={showSchedulePublishDialog}
        onOpenChange={setShowSchedulePublishDialog}
        targetId={product.aggregateId}
        targetType="product"
        action="publish"
        targetVersion={product.version}
        title={`Schedule Publish: ${product.name}`}
        description="Choose when to publish this product. It will become visible to customers at the scheduled time."
      />

      <ScheduleActionDialog
        open={showScheduleUnpublishDialog}
        onOpenChange={setShowScheduleUnpublishDialog}
        targetId={product.aggregateId}
        targetType="product"
        action="unpublish"
        targetVersion={product.version}
        title={`Schedule Unpublish: ${product.name}`}
        description="Choose when to unpublish this product. It will be hidden from customers at the scheduled time."
      />

      <ScheduleActionDialog
        open={showScheduleArchiveDialog}
        onOpenChange={setShowScheduleArchiveDialog}
        targetId={product.aggregateId}
        targetType="product"
        action="archive"
        targetVersion={product.version}
        title={`Schedule Archive: ${product.name}`}
        description="Choose when to archive this product. It will be hidden from all listings at the scheduled time."
      />

      {/* View All Schedules Dialog */}
      <ProductSchedulesDialog
        open={showSchedulesDialog}
        onOpenChange={setShowSchedulesDialog}
        productId={product.aggregateId}
        productName={product.name}
      />
    </>
  );
}

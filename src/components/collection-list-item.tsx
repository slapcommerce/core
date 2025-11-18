import * as React from "react";
import { useState } from "react";
import type { Collection } from "@/hooks/use-collections";
import {
  usePublishCollection,
  useUnpublishCollection,
  useArchiveCollection,
} from "@/hooks/use-collections";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  IconEdit,
  IconClock,
  IconPhoto,
  IconDots,
  IconWorld,
  IconEyeOff,
  IconArchive,
  IconCalendar,
  IconRoute,
} from "@tabler/icons-react";
import { useCollectionSchedules } from "@/hooks/use-schedules";
import { format } from "date-fns";
import { ResponsiveImage } from "@/components/responsive-image";
import { toast } from "sonner";
import { ScheduleActionDialog } from "@/components/schedule-action-dialog";
import { CollectionSchedulesDialog } from "@/components/collection-schedules-dialog";
import { SlugRedirectChain } from "@/components/slug-redirect-chain";

interface CollectionListItemProps {
  collection: Collection;
  onEdit: () => void;
}

// Helper to get action label and color
const ACTION_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  publishCollection: {
    label: "Publishes",
    color: "text-zen-moss",
    bgColor: "bg-zen-moss/10",
  },
  unpublishCollection: {
    label: "Unpublishes",
    color: "text-punk-orange",
    bgColor: "bg-punk-orange/10",
  },
  archiveCollection: {
    label: "Archives",
    color: "text-punk-red",
    bgColor: "bg-punk-red/10",
  },
};

export function CollectionListItem({
  collection,
  onEdit,
}: CollectionListItemProps) {
  // Safety check
  if (!collection) {
    return null;
  }

  const { data: schedules } = useCollectionSchedules(collection.collection_id);
  const publishMutation = usePublishCollection();
  const unpublishMutation = useUnpublishCollection();
  const archiveMutation = useArchiveCollection();

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
  const [showRedirectDialog, setShowRedirectDialog] = useState(false);

  const isArchived = collection.status === "archived";
  const isDraft = collection.status === "draft";
  const isActive = collection.status === "active";

  const pendingSchedules =
    schedules?.filter((s) => s.status === "pending") || [];

  // Check if there's a pending publish schedule
  const hasPendingPublish = pendingSchedules.some(
    (s) => s.command_type === "publishCollection"
  );

  // Check if there's a pending unpublish schedule
  const hasPendingUnpublish = pendingSchedules.some(
    (s) => s.command_type === "unpublishCollection"
  );

  // Check if there's a pending archive schedule
  const hasPendingArchive = pendingSchedules.some(
    (s) => s.command_type === "archiveCollection"
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

  // Get primary image (first image in the array)
  const primaryImage = collection.images?.[0];

  const confirmPublish = async () => {
    try {
      await publishMutation.mutateAsync({
        id: collection.collection_id,
        expectedVersion: collection.version,
      });
      toast.success("Collection published successfully");
      setShowPublishDialog(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to publish collection"
      );
    }
  };

  const confirmUnpublish = async () => {
    try {
      await unpublishMutation.mutateAsync({
        id: collection.collection_id,
        expectedVersion: collection.version,
      });
      toast.success("Collection unpublished successfully");
      setShowUnpublishDialog(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to unpublish collection"
      );
    }
  };

  const confirmArchive = async () => {
    try {
      await archiveMutation.mutateAsync({
        id: collection.collection_id,
        expectedVersion: collection.version,
      });
      toast.success("Collection archived successfully");
      setShowArchiveDialog(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to archive collection"
      );
    }
  };

  return (
    <>
      <div className="p-4 lg:p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          {/* Left: Collection Info */}
          <div className="flex gap-4 flex-1 min-w-0">
            {/* Image */}
            <div className="shrink-0">
              {primaryImage ? (
                <ResponsiveImage
                  imageUrls={primaryImage.urls}
                  alt={primaryImage.altText || collection.title}
                  className="size-16 lg:size-20 rounded-lg object-cover border-2 border-border"
                  sizePreset="thumbnail"
                  sizes="80px"
                  placeholder={
                    <div className="flex size-16 lg:size-20 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/60">
                      <IconPhoto className="size-6 text-muted-foreground/60" />
                    </div>
                  }
                />
              ) : (
                <div className="flex size-16 lg:size-20 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/60">
                  <IconPhoto className="size-6 text-muted-foreground/60" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h3 className="font-semibold text-base lg:text-lg truncate">
                  {collection.title}
                </h3>
                <Badge
                  variant={
                    collection.status === "active"
                      ? "default"
                      : collection.status === "draft"
                        ? "outline"
                        : "secondary"
                  }
                >
                  {collection.status}
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

              <div className="space-y-2">
                {collection.short_description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {collection.short_description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {collection.published_at && (
                    <span>
                      Published{" "}
                      {new Date(collection.published_at).toLocaleDateString()}
                    </span>
                  )}
                  {collection.images.length > 0 && (
                    <span>
                      {collection.images.length} image
                      {collection.images.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 lg:shrink-0">
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

                {/* Scheduled Actions */}
                {pendingSchedules.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setShowSchedulesDialog(true)}
                    >
                      <IconClock className="size-4 mr-2" />
                      View Scheduled Actions ({pendingSchedules.length})
                    </DropdownMenuItem>
                  </>
                )}

                {/* Redirect Chain */}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowRedirectDialog(true)}>
                  <IconRoute className="size-4 mr-2" />
                  View Redirect Chain
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Publish Confirmation Dialog */}
      <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish Collection</DialogTitle>
            <DialogDescription>
              This will make the collection visible to customers. Are you sure
              you want to publish "{collection.title}"?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPublishDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmPublish}
              disabled={publishMutation.isPending}
            >
              {publishMutation.isPending ? "Publishing..." : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unpublish Confirmation Dialog */}
      <Dialog
        open={showUnpublishDialog}
        onOpenChange={setShowUnpublishDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unpublish Collection</DialogTitle>
            <DialogDescription>
              This will hide the collection from customers. Are you sure you
              want to unpublish "{collection.title}"?
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
              onClick={confirmUnpublish}
              disabled={unpublishMutation.isPending}
              variant="secondary"
            >
              {unpublishMutation.isPending ? "Unpublishing..." : "Unpublish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Collection</DialogTitle>
            <DialogDescription>
              This will archive the collection and make it read-only. Are you
              sure you want to archive "{collection.title}"?
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
              onClick={confirmArchive}
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
        targetId={collection.collection_id}
        targetType="collection"
        action="publish"
        targetVersion={collection.version}
        title={`Schedule Publish: ${collection.title}`}
        description="Choose when to publish this collection. It will become visible to customers at the scheduled time."
      />

      <ScheduleActionDialog
        open={showScheduleUnpublishDialog}
        onOpenChange={setShowScheduleUnpublishDialog}
        targetId={collection.collection_id}
        targetType="collection"
        action="unpublish"
        targetVersion={collection.version}
        title={`Schedule Unpublish: ${collection.title}`}
        description="Choose when to unpublish this collection. It will be hidden from customers at the scheduled time."
      />

      <ScheduleActionDialog
        open={showScheduleArchiveDialog}
        onOpenChange={setShowScheduleArchiveDialog}
        targetId={collection.collection_id}
        targetType="collection"
        action="archive"
        targetVersion={collection.version}
        title={`Schedule Archive: ${collection.title}`}
        description="Choose when to archive this collection. It will be hidden from all listings at the scheduled time."
      />

      <CollectionSchedulesDialog
        open={showSchedulesDialog}
        onOpenChange={setShowSchedulesDialog}
        collectionId={collection.collection_id}
      />

      {/* Redirect Chain Dialog */}
      <Dialog open={showRedirectDialog} onOpenChange={setShowRedirectDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>URL Redirect Chain</DialogTitle>
            <DialogDescription>
              This shows all historical slugs and their redirects for this
              collection
            </DialogDescription>
          </DialogHeader>
          <SlugRedirectChain
            entityId={collection.collection_id}
            entityType="collection"
            currentSlug={collection.slug}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

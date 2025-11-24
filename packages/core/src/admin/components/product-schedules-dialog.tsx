import * as React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/admin/components/ui/dialog";
import { Button } from "@/admin/components/ui/button";
import { DateTimePicker } from "@/admin/components/ui/date-time-picker";
import {
  useProductSchedules,
  useCancelSchedule,
  useUpdateSchedule,
  type Schedule,
} from "@/admin/hooks/use-schedules";
import { IconTrash, IconEdit, IconCheck, IconX } from "@tabler/icons-react";

interface ProductSchedulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productTitle: string;
}

const ACTION_LABELS: Record<string, string> = {
  publishProduct: "publish this product",
  unpublishProduct: "unpublish this product",
  archiveProduct: "archive this product",
};

function ScheduleItem({
  schedule,
  onUpdate,
  onCancel,
}: {
  schedule: Schedule;
  onUpdate: (
    scheduleId: string,
    newDate: Date,
    version: number,
  ) => Promise<void>;
  onCancel: (scheduleId: string, version: number) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedDate, setEditedDate] = useState<Date>(
    new Date(schedule.scheduled_for),
  );
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const actionLabel =
    ACTION_LABELS[schedule.command_type] ||
    "perform an action on this product";

  const handleSaveEdit = async () => {
    try {
      await onUpdate(schedule.schedule_id, editedDate, schedule.version);
      setIsEditing(false);
      toast.success("Schedule updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update schedule",
      );
    }
  };

  const handleCancelEdit = () => {
    setEditedDate(new Date(schedule.scheduled_for));
    setIsEditing(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onCancel(schedule.schedule_id, schedule.version);
      toast.success("Schedule cancelled successfully");
      setShowDeleteDialog(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel schedule",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const isPending = schedule.status === "pending";

  return (
    <>
      <div className="border rounded-lg p-4 space-y-3 bg-card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <h4 className="font-medium text-base capitalize">
              Will {actionLabel}
            </h4>

            {isEditing ? (
              <div className="pt-1">
                <DateTimePicker
                  value={editedDate}
                  onChange={(date) => date && setEditedDate(date)}
                  minDate={new Date()}
                />
              </div>
            ) : (
              <div className="text-sm space-y-1.5">
                <p className="text-foreground">
                  📅{" "}
                  {format(
                    new Date(schedule.scheduled_for),
                    "EEEE, MMMM d 'at' h:mm a",
                  )}
                </p>
                <p className="text-muted-foreground text-xs">
                  👤 Created by {schedule.created_by}
                </p>
                {schedule.retry_count > 0 && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">
                    ⚠️ Retry attempt: {schedule.retry_count}
                  </p>
                )}
                {schedule.error_message && (
                  <p className="text-xs text-destructive">
                    ❌ Error: {schedule.error_message}
                  </p>
                )}
                {!isPending && schedule.status && (
                  <p className="text-xs text-muted-foreground capitalize">
                    Status: {schedule.status}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isEditing ? (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={handleSaveEdit}
                >
                  <IconCheck className="h-4 w-4 text-green-600" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={handleCancelEdit}
                >
                  <IconX className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => setIsEditing(true)}
                  disabled={!isPending}
                >
                  <IconEdit className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={!isPending}
                >
                  <IconTrash className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Scheduled Action?</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this scheduled action? This will
              prevent the product from being{" "}
              {actionLabel.replace("this product", "")}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Cancelling..." : "Cancel Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ProductSchedulesDialog({
  open,
  onOpenChange,
  productId,
  productTitle,
}: ProductSchedulesDialogProps) {
  const { data: schedules, isLoading } = useProductSchedules(productId);
  const cancelSchedule = useCancelSchedule();
  const updateSchedule = useUpdateSchedule();

  const handleUpdateSchedule = async (
    scheduleId: string,
    newDate: Date,
    version: number,
  ) => {
    await updateSchedule.mutateAsync({
      id: scheduleId,
      scheduledFor: newDate,
      commandData: null,
      expectedVersion: version,
    });
  };

  const handleCancelSchedule = async (scheduleId: string, version: number) => {
    await cancelSchedule.mutateAsync({
      id: scheduleId,
      expectedVersion: version,
    });
  };

  const pendingSchedules =
    schedules?.filter((s) => s.status === "pending") || [];
  const otherSchedules = schedules?.filter((s) => s.status !== "pending") || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Scheduled Actions</DialogTitle>
          <DialogDescription>
            View and manage scheduled actions for "{productTitle}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoading && (
            <div className="text-center text-muted-foreground py-8">
              Loading schedules...
            </div>
          )}

          {!isLoading && schedules && schedules.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              No scheduled actions for this product
            </div>
          )}

          {!isLoading && pendingSchedules.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium text-sm">Pending Schedules</h3>
              {pendingSchedules.map((schedule) => (
                <ScheduleItem
                  key={schedule.schedule_id}
                  schedule={schedule}
                  onUpdate={handleUpdateSchedule}
                  onCancel={handleCancelSchedule}
                />
              ))}
            </div>
          )}

          {!isLoading && otherSchedules.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium text-sm">History</h3>
              {otherSchedules.map((schedule) => (
                <ScheduleItem
                  key={schedule.schedule_id}
                  schedule={schedule}
                  onUpdate={handleUpdateSchedule}
                  onCancel={handleCancelSchedule}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

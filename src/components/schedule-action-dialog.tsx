import * as React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { uuidv7 } from "uuidv7";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  useCreateSchedule,
  useCollectionSchedules,
  useProductSchedules,
} from "@/hooks/use-schedules";
import { authClient } from "@/lib/auth-client";

interface ScheduleActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetId: string;
  targetType: "collection" | "product";
  action: "publish" | "unpublish" | "archive";
  targetVersion: number;
  title: string;
  description: string;
}

const ACTION_CONFIG: Record<
  "collection" | "product",
  Record<
    "publish" | "unpublish" | "archive",
    {
      commandType: string;
      successMessage: string;
    }
  >
> = {
  collection: {
    publish: {
      commandType: "publishCollection",
      successMessage: "Collection publish scheduled successfully",
    },
    unpublish: {
      commandType: "unpublishCollection",
      successMessage: "Collection unpublish scheduled successfully",
    },
    archive: {
      commandType: "archiveCollection",
      successMessage: "Collection archive scheduled successfully",
    },
  },
  product: {
    publish: {
      commandType: "publishProduct",
      successMessage: "Product publish scheduled successfully",
    },
    unpublish: {
      commandType: "unpublishProduct",
      successMessage: "Product unpublish scheduled successfully",
    },
    archive: {
      commandType: "archiveProduct",
      successMessage: "Product archive scheduled successfully",
    },
  },
};

export function ScheduleActionDialog({
  open,
  onOpenChange,
  targetId,
  targetType,
  action,
  targetVersion,
  title,
  description,
}: ScheduleActionDialogProps) {
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(
    undefined,
  );
  const createSchedule = useCreateSchedule();
  const { data: session } = authClient.useSession();

  // Conditionally use the right hook based on target type
  const { data: collectionSchedules } = useCollectionSchedules(
    targetType === "collection" ? targetId : undefined,
  );
  const { data: productSchedules } = useProductSchedules(
    targetType === "product" ? targetId : undefined,
  );

  const existingSchedules = targetType === "collection" ? collectionSchedules : productSchedules;

  const config = ACTION_CONFIG[targetType][action];

  // Check for conflicting schedules
  const hasConflictingSchedule = React.useMemo(() => {
    if (!existingSchedules) return false;
    return existingSchedules.some(
      (schedule) =>
        schedule.command_type === config.commandType &&
        schedule.status === "pending",
    );
  }, [existingSchedules, config.commandType]);

  // Find the pending publish schedule (if any) for validation
  const pendingPublishSchedule = React.useMemo(() => {
    if (!existingSchedules) return null;
    const publishCommandType =
      targetType === "collection" ? "publishCollection" : "publishProduct";
    return existingSchedules.find(
      (schedule) =>
        schedule.command_type === publishCommandType &&
        schedule.status === "pending",
    );
  }, [existingSchedules, targetType]);

  // Reset date when dialog closes
  React.useEffect(() => {
    if (!open) {
      setScheduledDate(undefined);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!scheduledDate) {
      toast.error("Please select a date and time");
      return;
    }

    // Validate future date
    const now = new Date();
    if (scheduledDate <= now) {
      toast.error("Scheduled time must be in the future");
      return;
    }

    // Check for conflicts
    if (hasConflictingSchedule) {
      toast.error(
        `A ${action} is already scheduled for this ${targetType}. Please cancel or edit the existing schedule first.`,
      );
      return;
    }

    // Validate that unpublish/archive is scheduled after publish
    if (
      (action === "unpublish" || action === "archive") &&
      pendingPublishSchedule
    ) {
      const publishDate = new Date(pendingPublishSchedule.scheduled_for);
      if (scheduledDate <= publishDate) {
        toast.error(
          `Scheduled ${action} must be after the scheduled publish time (${new Date(pendingPublishSchedule.scheduled_for).toLocaleString()})`,
        );
        return;
      }
    }

    if (!session?.user?.email) {
      toast.error("You must be logged in to schedule actions");
      return;
    }

    try {
      await createSchedule.mutateAsync({
        id: uuidv7(),
        correlationId: uuidv7(),
        targetAggregateId: targetId,
        targetAggregateType: targetType,
        commandType: config.commandType,
        commandData: {
          expectedVersion: targetVersion,
        },
        scheduledFor: scheduledDate,
        createdBy: session.user.email,
      });

      toast.success(config.successMessage);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to schedule action",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {hasConflictingSchedule && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              A {action} is already scheduled for this {targetType}. Cancel
              the existing schedule before creating a new one.
            </div>
          )}

          {(action === "unpublish" || action === "archive") &&
            pendingPublishSchedule && (
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-sm text-blue-700 dark:text-blue-400">
                This {targetType} has a scheduled publish on{" "}
                {new Date(
                  pendingPublishSchedule.scheduled_for,
                ).toLocaleString()}
                . The {action} must be scheduled after that time.
              </div>
            )}

          <DateTimePicker
            value={scheduledDate}
            onChange={setScheduledDate}
            disabled={createSchedule.isPending || hasConflictingSchedule}
            placeholder="Select date and time"
            minDate={
              (action === "unpublish" || action === "archive") &&
              pendingPublishSchedule
                ? new Date(pendingPublishSchedule.scheduled_for)
                : new Date()
            }
          />

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createSchedule.isPending}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                createSchedule.isPending ||
                !scheduledDate ||
                hasConflictingSchedule
              }
              className="w-full sm:w-auto"
            >
              {createSchedule.isPending ? "Scheduling..." : "Schedule Action"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

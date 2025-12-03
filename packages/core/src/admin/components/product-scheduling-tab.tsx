import * as React from "react";
import type { Product } from "@/admin/hooks/use-products";
import { Button } from "@/admin/components/ui/button";
import { Skeleton } from "@/admin/components/ui/skeleton";
import { ScheduleCard } from "@/admin/components/schedule-card";
import { ScheduleDropDialog } from "@/admin/components/schedule-drop-dialog";
import {
  useSchedules,
  useScheduleProductDrop,
  useUpdateScheduledProductDrop,
  useCancelScheduledProductDrop,
  type Schedule,
} from "@/admin/hooks/use-schedules";
import { authClient } from "@/admin/lib/auth-client";
import { toast } from "sonner";
import { IconCalendarPlus } from "@tabler/icons-react";

interface ProductSchedulingTabProps {
  product: Product;
}

export function ProductSchedulingTab({ product }: ProductSchedulingTabProps) {
  const { data: session } = authClient.useSession();
  const { data: schedules, isLoading: schedulesLoading } = useSchedules(product.aggregateId);

  const scheduleProductDrop = useScheduleProductDrop();
  const updateScheduledProductDrop = useUpdateScheduledProductDrop();
  const cancelScheduledProductDrop = useCancelScheduledProductDrop();

  const [showDropDialog, setShowDropDialog] = React.useState(false);
  const [editingSchedule, setEditingSchedule] = React.useState<Schedule | null>(null);

  // Filter schedules by type
  const dropSchedules = React.useMemo(
    () => schedules?.filter((s) => s.scheduleType.includes("drop")) ?? [],
    [schedules]
  );

  const pendingDropSchedule = React.useMemo(
    () => dropSchedules.find((s) => s.status === "pending"),
    [dropSchedules]
  );

  const handleScheduleDrop = async (data: { dropType: "hidden" | "visible"; scheduledFor: Date }) => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to schedule a drop");
      return;
    }

    try {
      if (editingSchedule) {
        // Update existing schedule
        await updateScheduledProductDrop.mutateAsync({
          id: product.aggregateId,
          userId: session.user.id,
          fulfillmentType: product.productType,
          dropType: data.dropType,
          scheduledFor: data.scheduledFor,
          expectedVersion: product.version,
        });
        toast.success("Drop schedule updated");
      } else {
        // Create new schedule
        await scheduleProductDrop.mutateAsync({
          id: product.aggregateId,
          correlationId: crypto.randomUUID(),
          userId: session.user.id,
          fulfillmentType: product.productType,
          dropType: data.dropType,
          scheduledFor: data.scheduledFor,
          expectedVersion: product.version,
        });
        toast.success("Drop scheduled successfully");
      }
      setEditingSchedule(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to schedule drop");
      throw error;
    }
  };

  const handleCancelDrop = async () => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to cancel a drop");
      return;
    }

    try {
      await cancelScheduledProductDrop.mutateAsync({
        id: product.aggregateId,
        userId: session.user.id,
        fulfillmentType: product.productType,
        expectedVersion: product.version,
      });
      toast.success("Drop schedule cancelled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel drop");
    }
  };

  const handleEditDrop = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setShowDropDialog(true);
  };

  const handleDialogClose = (open: boolean) => {
    setShowDropDialog(open);
    if (!open) {
      setEditingSchedule(null);
    }
  };

  const isLoading =
    scheduleProductDrop.isPending ||
    updateScheduledProductDrop.isPending ||
    cancelScheduledProductDrop.isPending;

  if (schedulesLoading) {
    return (
      <div className="space-y-4 pb-6">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      {/* Drop Scheduling Section */}
      <div className="space-y-4 rounded-lg border border-border/60 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Product Drop</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Schedule when this product becomes available for purchase
            </p>
          </div>
          {!pendingDropSchedule && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDropDialog(true)}
              disabled={isLoading}
            >
              <IconCalendarPlus className="h-4 w-4 mr-2" />
              Schedule Drop
            </Button>
          )}
        </div>

        {/* Show existing pending schedule */}
        {pendingDropSchedule && (
          <ScheduleCard
            schedule={pendingDropSchedule}
            onEdit={() => handleEditDrop(pendingDropSchedule)}
            onCancel={handleCancelDrop}
            isLoading={isLoading}
          />
        )}

        {/* Show message if no schedule */}
        {!pendingDropSchedule && (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No drop scheduled. Click "Schedule Drop" to set a launch date.
          </div>
        )}
      </div>

      {/* Past Schedules Section */}
      {dropSchedules.filter((s) => s.status !== "pending").length > 0 && (
        <div className="space-y-4 rounded-lg border border-border/60 p-4">
          <h3 className="text-sm font-semibold">Schedule History</h3>
          <div className="space-y-3">
            {dropSchedules
              .filter((s) => s.status !== "pending")
              .map((schedule) => (
                <ScheduleCard key={schedule.scheduleId} schedule={schedule} />
              ))}
          </div>
        </div>
      )}

      {/* Drop Schedule Dialog */}
      <ScheduleDropDialog
        open={showDropDialog}
        onOpenChange={handleDialogClose}
        existingSchedule={
          editingSchedule
            ? {
                dropType: (editingSchedule.metadata?.dropType as "hidden" | "visible") ?? "visible",
                scheduledFor: new Date(editingSchedule.dueAt),
              }
            : undefined
        }
        onSubmit={handleScheduleDrop}
        isLoading={isLoading}
      />
    </div>
  );
}

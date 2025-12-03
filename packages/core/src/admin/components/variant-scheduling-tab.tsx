import * as React from "react";
import type { Variant } from "@/admin/hooks/use-variants";
import type { Product } from "@/admin/hooks/use-products";
import { Button } from "@/admin/components/ui/button";
import { Skeleton } from "@/admin/components/ui/skeleton";
import { ScheduleCard } from "@/admin/components/schedule-card";
import { ScheduleDropDialog } from "@/admin/components/schedule-drop-dialog";
import { ScheduleSaleDialog } from "@/admin/components/schedule-sale-dialog";
import {
  useSchedules,
  useScheduleVariantDrop,
  useUpdateScheduledVariantDrop,
  useCancelScheduledVariantDrop,
  useScheduleVariantSale,
  useUpdateScheduledVariantSale,
  useCancelScheduledVariantSale,
  type Schedule,
} from "@/admin/hooks/use-schedules";
import { authClient } from "@/admin/lib/auth-client";
import { toast } from "sonner";
import { IconCalendarPlus, IconTag } from "@tabler/icons-react";

interface VariantSchedulingTabProps {
  variant: Variant;
  product: Product;
}

export function VariantSchedulingTab({ variant, product }: VariantSchedulingTabProps) {
  const { data: session } = authClient.useSession();
  const { data: schedules, isLoading: schedulesLoading } = useSchedules(variant.aggregateId);

  // Drop schedule hooks
  const scheduleVariantDrop = useScheduleVariantDrop();
  const updateScheduledVariantDrop = useUpdateScheduledVariantDrop();
  const cancelScheduledVariantDrop = useCancelScheduledVariantDrop();

  // Sale schedule hooks
  const scheduleVariantSale = useScheduleVariantSale();
  const updateScheduledVariantSale = useUpdateScheduledVariantSale();
  const cancelScheduledVariantSale = useCancelScheduledVariantSale();

  const [showDropDialog, setShowDropDialog] = React.useState(false);
  const [editingDropSchedule, setEditingDropSchedule] = React.useState<Schedule | null>(null);
  const [showSaleDialog, setShowSaleDialog] = React.useState(false);
  const [editingSaleSchedule, setEditingSaleSchedule] = React.useState<Schedule | null>(null);

  // Filter schedules by type
  const dropSchedules = React.useMemo(
    () => schedules?.filter((s) => s.scheduleType.includes("drop")) ?? [],
    [schedules]
  );

  const saleSchedules = React.useMemo(
    () => schedules?.filter((s) => s.scheduleType.includes("sale")) ?? [],
    [schedules]
  );

  const pendingDropSchedule = React.useMemo(
    () => dropSchedules.find((s) => s.status === "pending"),
    [dropSchedules]
  );

  const pendingSaleSchedule = React.useMemo(
    () => saleSchedules.find((s) => s.status === "pending"),
    [saleSchedules]
  );

  const handleScheduleDrop = async (data: { dropType: "hidden" | "visible"; scheduledFor: Date }) => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to schedule a drop");
      return;
    }

    try {
      if (editingDropSchedule) {
        await updateScheduledVariantDrop.mutateAsync({
          id: variant.aggregateId,
          userId: session.user.id,
          fulfillmentType: product.productType,
          dropType: data.dropType,
          scheduledFor: data.scheduledFor,
          expectedVersion: variant.version,
        });
        toast.success("Drop schedule updated");
      } else {
        await scheduleVariantDrop.mutateAsync({
          id: variant.aggregateId,
          correlationId: crypto.randomUUID(),
          userId: session.user.id,
          fulfillmentType: product.productType,
          dropType: data.dropType,
          scheduledFor: data.scheduledFor,
          expectedVersion: variant.version,
        });
        toast.success("Drop scheduled successfully");
      }
      setEditingDropSchedule(null);
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
      await cancelScheduledVariantDrop.mutateAsync({
        id: variant.aggregateId,
        userId: session.user.id,
        fulfillmentType: product.productType,
        expectedVersion: variant.version,
      });
      toast.success("Drop schedule cancelled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel drop");
    }
  };

  const handleScheduleSale = async (data: {
    saleType: "percent" | "fixed" | "amount";
    saleValue: number;
    startDate: Date;
    endDate: Date;
  }) => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to schedule a sale");
      return;
    }

    try {
      if (editingSaleSchedule) {
        await updateScheduledVariantSale.mutateAsync({
          id: variant.aggregateId,
          userId: session.user.id,
          fulfillmentType: product.productType,
          saleType: data.saleType,
          saleValue: data.saleValue,
          startDate: data.startDate,
          endDate: data.endDate,
          expectedVersion: variant.version,
        });
        toast.success("Sale schedule updated");
      } else {
        await scheduleVariantSale.mutateAsync({
          id: variant.aggregateId,
          correlationId: crypto.randomUUID(),
          userId: session.user.id,
          fulfillmentType: product.productType,
          saleType: data.saleType,
          saleValue: data.saleValue,
          startDate: data.startDate,
          endDate: data.endDate,
          expectedVersion: variant.version,
        });
        toast.success("Sale scheduled successfully");
      }
      setEditingSaleSchedule(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to schedule sale");
      throw error;
    }
  };

  const handleCancelSale = async () => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to cancel a sale");
      return;
    }

    try {
      await cancelScheduledVariantSale.mutateAsync({
        id: variant.aggregateId,
        userId: session.user.id,
        fulfillmentType: product.productType,
        expectedVersion: variant.version,
      });
      toast.success("Sale schedule cancelled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel sale");
    }
  };

  const handleDropDialogClose = (open: boolean) => {
    setShowDropDialog(open);
    if (!open) {
      setEditingDropSchedule(null);
    }
  };

  const handleSaleDialogClose = (open: boolean) => {
    setShowSaleDialog(open);
    if (!open) {
      setEditingSaleSchedule(null);
    }
  };

  const isDropLoading =
    scheduleVariantDrop.isPending ||
    updateScheduledVariantDrop.isPending ||
    cancelScheduledVariantDrop.isPending;

  const isSaleLoading =
    scheduleVariantSale.isPending ||
    updateScheduledVariantSale.isPending ||
    cancelScheduledVariantSale.isPending;

  if (schedulesLoading) {
    return (
      <div className="space-y-4 pb-6">
        <Skeleton className="h-32 w-full" />
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
            <h3 className="text-sm font-semibold">Variant Drop</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Schedule when this variant becomes available
            </p>
          </div>
          {!pendingDropSchedule && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDropDialog(true)}
              disabled={isDropLoading}
            >
              <IconCalendarPlus className="h-4 w-4 mr-2" />
              Schedule Drop
            </Button>
          )}
        </div>

        {pendingDropSchedule && (
          <ScheduleCard
            schedule={pendingDropSchedule}
            onEdit={() => {
              setEditingDropSchedule(pendingDropSchedule);
              setShowDropDialog(true);
            }}
            onCancel={handleCancelDrop}
            isLoading={isDropLoading}
          />
        )}

        {!pendingDropSchedule && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No drop scheduled for this variant.
          </div>
        )}
      </div>

      {/* Sale Scheduling Section */}
      <div className="space-y-4 rounded-lg border border-border/60 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Variant Sale</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Schedule a temporary price discount for this variant
            </p>
          </div>
          {!pendingSaleSchedule && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSaleDialog(true)}
              disabled={isSaleLoading}
            >
              <IconTag className="h-4 w-4 mr-2" />
              Schedule Sale
            </Button>
          )}
        </div>

        {pendingSaleSchedule && (
          <ScheduleCard
            schedule={pendingSaleSchedule}
            onEdit={() => {
              setEditingSaleSchedule(pendingSaleSchedule);
              setShowSaleDialog(true);
            }}
            onCancel={handleCancelSale}
            isLoading={isSaleLoading}
          />
        )}

        {!pendingSaleSchedule && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No sale scheduled for this variant.
          </div>
        )}
      </div>

      {/* Drop Schedule Dialog */}
      <ScheduleDropDialog
        open={showDropDialog}
        onOpenChange={handleDropDialogClose}
        existingSchedule={
          editingDropSchedule
            ? {
                dropType: (editingDropSchedule.metadata?.dropType as "hidden" | "visible") ?? "visible",
                scheduledFor: new Date(editingDropSchedule.dueAt),
              }
            : undefined
        }
        onSubmit={handleScheduleDrop}
        isLoading={isDropLoading}
      />

      {/* Sale Schedule Dialog */}
      <ScheduleSaleDialog
        open={showSaleDialog}
        onOpenChange={handleSaleDialogClose}
        existingSchedule={
          editingSaleSchedule
            ? {
                saleType: editingSaleSchedule.metadata?.saleType as "percent" | "fixed" | "amount",
                saleValue: editingSaleSchedule.metadata?.saleValue as number,
                startDate: new Date(editingSaleSchedule.dueAt),
                endDate: new Date(editingSaleSchedule.metadata?.endDate as string),
              }
            : undefined
        }
        onSubmit={handleScheduleSale}
        isLoading={isSaleLoading}
      />
    </div>
  );
}

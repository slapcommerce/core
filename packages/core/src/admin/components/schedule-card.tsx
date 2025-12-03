import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/admin/components/ui/card";
import { Badge } from "@/admin/components/ui/badge";
import { Button } from "@/admin/components/ui/button";
import { format } from "date-fns";
import { IconCalendar, IconEdit, IconTrash, IconTag, IconEye, IconEyeOff } from "@tabler/icons-react";
import type { Schedule } from "@/admin/hooks/use-schedules";

interface ScheduleCardProps {
  schedule: Schedule;
  onEdit?: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

function getStatusBadgeVariant(status: Schedule["status"]): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "pending":
      return "default";
    case "completed":
      return "secondary";
    case "cancelled":
      return "outline";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

function getScheduleTypeLabel(scheduleType: string): string {
  if (scheduleType.includes("drop")) {
    return "Drop";
  }
  if (scheduleType.includes("sale")) {
    return "Sale";
  }
  return scheduleType;
}

function getScheduleIcon(scheduleType: string, metadata: Record<string, unknown> | null) {
  if (scheduleType.includes("drop")) {
    const dropType = metadata?.dropType as string | undefined;
    if (dropType === "hidden") {
      return <IconEyeOff className="h-4 w-4" />;
    }
    return <IconEye className="h-4 w-4" />;
  }
  if (scheduleType.includes("sale")) {
    return <IconTag className="h-4 w-4" />;
  }
  return <IconCalendar className="h-4 w-4" />;
}

export function ScheduleCard({ schedule, onEdit, onCancel, isLoading = false }: ScheduleCardProps) {
  const canEdit = schedule.status === "pending";
  const canCancel = schedule.status === "pending";

  const formatScheduleDetails = () => {
    const metadata = schedule.metadata;
    const details: string[] = [];

    if (metadata?.dropType) {
      details.push(`${metadata.dropType === "hidden" ? "Hidden" : "Visible"} drop`);
    }

    if (metadata?.saleType) {
      const saleType = metadata.saleType as string;
      const saleValue = metadata.saleValue as number;

      if (saleType === "percent") {
        details.push(`${(saleValue * 100).toFixed(0)}% off`);
      } else if (saleType === "fixed") {
        details.push(`$${saleValue.toFixed(2)} sale price`);
      } else if (saleType === "amount") {
        details.push(`$${saleValue.toFixed(2)} off`);
      }
    }

    if (metadata?.endDate) {
      details.push(`Ends: ${format(new Date(metadata.endDate as string), "PPP")}`);
    }

    return details.join(" | ");
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getScheduleIcon(schedule.scheduleType, schedule.metadata)}
            <CardTitle className="text-base font-medium">
              {getScheduleTypeLabel(schedule.scheduleType)} Schedule
            </CardTitle>
          </div>
          <Badge variant={getStatusBadgeVariant(schedule.status)}>
            {schedule.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <IconCalendar className="h-4 w-4" />
            <span>Scheduled for: {format(new Date(schedule.dueAt), "PPP 'at' p")}</span>
          </div>

          {formatScheduleDetails() && (
            <p className="text-sm text-muted-foreground">
              {formatScheduleDetails()}
            </p>
          )}

          {schedule.errorMessage && (
            <p className="text-sm text-destructive">
              Error: {schedule.errorMessage}
            </p>
          )}

          {(canEdit || canCancel) && (
            <div className="flex gap-2 pt-2">
              {canEdit && onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onEdit}
                  disabled={isLoading}
                >
                  <IconEdit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
              {canCancel && onCancel && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCancel}
                  disabled={isLoading}
                  className="text-destructive hover:text-destructive"
                >
                  <IconTrash className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

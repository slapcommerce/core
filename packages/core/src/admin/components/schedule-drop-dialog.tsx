import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/admin/components/ui/dialog";
import { Button } from "@/admin/components/ui/button";
import { Label } from "@/admin/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/admin/components/ui/select";
import { DateTimePicker } from "@/admin/components/ui/date-time-picker";

interface ScheduleDropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingSchedule?: {
    dropType: "hidden" | "visible";
    scheduledFor: Date;
  };
  onSubmit: (data: { dropType: "hidden" | "visible"; scheduledFor: Date }) => Promise<void>;
  isLoading?: boolean;
}

export function ScheduleDropDialog({
  open,
  onOpenChange,
  existingSchedule,
  onSubmit,
  isLoading = false,
}: ScheduleDropDialogProps) {
  const [dropType, setDropType] = React.useState<"hidden" | "visible">(
    existingSchedule?.dropType ?? "visible"
  );
  const [scheduledFor, setScheduledFor] = React.useState<Date | undefined>(
    existingSchedule?.scheduledFor ?? undefined
  );
  const [error, setError] = React.useState<string | null>(null);

  // Reset form when dialog opens/closes or existing schedule changes
  React.useEffect(() => {
    if (open) {
      setDropType(existingSchedule?.dropType ?? "visible");
      setScheduledFor(existingSchedule?.scheduledFor ?? undefined);
      setError(null);
    }
  }, [open, existingSchedule]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!scheduledFor) {
      setError("Please select a date and time for the drop");
      return;
    }

    if (scheduledFor <= new Date()) {
      setError("Drop date must be in the future");
      return;
    }

    try {
      await onSubmit({ dropType, scheduledFor });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule drop");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existingSchedule ? "Edit Drop Schedule" : "Schedule Drop"}</DialogTitle>
          <DialogDescription>
            Schedule when this becomes available for purchase.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dropType">Drop Type</Label>
            <Select
              value={dropType}
              onValueChange={(val) => setDropType(val as "hidden" | "visible")}
              disabled={isLoading}
            >
              <SelectTrigger id="dropType">
                <SelectValue placeholder="Select drop type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="visible">
                  <div className="flex flex-col">
                    <span>Visible</span>
                    <span className="text-xs text-muted-foreground">
                      Visible before drop, purchasable after
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="hidden">
                  <div className="flex flex-col">
                    <span>Hidden</span>
                    <span className="text-xs text-muted-foreground">
                      Hidden until drop time
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Drop Date & Time</Label>
            <DateTimePicker
              value={scheduledFor}
              onChange={setScheduledFor}
              disabled={isLoading}
              minDate={new Date()}
              placeholder="Select when to drop"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              {isLoading
                ? "Saving..."
                : existingSchedule
                  ? "Update Schedule"
                  : "Schedule Drop"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

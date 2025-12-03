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
import { Input } from "@/admin/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/admin/components/ui/select";
import { DateTimePicker } from "@/admin/components/ui/date-time-picker";

type SaleType = "percent" | "fixed" | "amount";

interface ScheduleSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingSchedule?: {
    saleType: SaleType;
    saleValue: number;
    startDate: Date;
    endDate: Date;
  };
  onSubmit: (data: {
    saleType: SaleType;
    saleValue: number;
    startDate: Date;
    endDate: Date;
  }) => Promise<void>;
  isLoading?: boolean;
}

export function ScheduleSaleDialog({
  open,
  onOpenChange,
  existingSchedule,
  onSubmit,
  isLoading = false,
}: ScheduleSaleDialogProps) {
  const [saleType, setSaleType] = React.useState<SaleType>(
    existingSchedule?.saleType ?? "percent"
  );
  const [saleValue, setSaleValue] = React.useState<string>(
    existingSchedule?.saleValue !== undefined
      ? existingSchedule.saleType === "percent"
        ? (existingSchedule.saleValue * 100).toString()
        : existingSchedule.saleValue.toString()
      : ""
  );
  const [startDate, setStartDate] = React.useState<Date | undefined>(
    existingSchedule?.startDate ?? undefined
  );
  const [endDate, setEndDate] = React.useState<Date | undefined>(
    existingSchedule?.endDate ?? undefined
  );
  const [error, setError] = React.useState<string | null>(null);

  // Reset form when dialog opens/closes or existing schedule changes
  React.useEffect(() => {
    if (open) {
      setSaleType(existingSchedule?.saleType ?? "percent");
      setSaleValue(
        existingSchedule?.saleValue !== undefined
          ? existingSchedule.saleType === "percent"
            ? (existingSchedule.saleValue * 100).toString()
            : existingSchedule.saleValue.toString()
          : ""
      );
      setStartDate(existingSchedule?.startDate ?? undefined);
      setEndDate(existingSchedule?.endDate ?? undefined);
      setError(null);
    }
  }, [open, existingSchedule]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numericValue = parseFloat(saleValue);

    if (isNaN(numericValue) || numericValue <= 0) {
      setError("Please enter a valid sale value");
      return;
    }

    if (saleType === "percent" && (numericValue <= 0 || numericValue > 100)) {
      setError("Percentage must be between 0 and 100");
      return;
    }

    if (!startDate) {
      setError("Please select a start date");
      return;
    }

    if (!endDate) {
      setError("Please select an end date");
      return;
    }

    if (endDate <= startDate) {
      setError("End date must be after start date");
      return;
    }

    if (startDate <= new Date()) {
      setError("Start date must be in the future");
      return;
    }

    // Convert percentage to decimal for backend
    const finalValue = saleType === "percent" ? numericValue / 100 : numericValue;

    try {
      await onSubmit({
        saleType,
        saleValue: finalValue,
        startDate,
        endDate,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule sale");
    }
  };

  const getSaleValueLabel = () => {
    switch (saleType) {
      case "percent":
        return "Discount Percentage (%)";
      case "fixed":
        return "Sale Price ($)";
      case "amount":
        return "Discount Amount ($)";
    }
  };

  const getSaleValuePlaceholder = () => {
    switch (saleType) {
      case "percent":
        return "e.g. 20 for 20% off";
      case "fixed":
        return "e.g. 29.99";
      case "amount":
        return "e.g. 10.00 off";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existingSchedule ? "Edit Sale Schedule" : "Schedule Sale"}</DialogTitle>
          <DialogDescription>
            Set a temporary discount that automatically starts and ends.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="saleType">Sale Type</Label>
            <Select
              value={saleType}
              onValueChange={(val) => {
                setSaleType(val as SaleType);
                setSaleValue(""); // Reset value when type changes
              }}
              disabled={isLoading}
            >
              <SelectTrigger id="saleType">
                <SelectValue placeholder="Select sale type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">
                  <div className="flex flex-col">
                    <span>Percentage Off</span>
                    <span className="text-xs text-muted-foreground">
                      e.g. 20% off original price
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="fixed">
                  <div className="flex flex-col">
                    <span>Fixed Price</span>
                    <span className="text-xs text-muted-foreground">
                      Set a specific sale price
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="amount">
                  <div className="flex flex-col">
                    <span>Amount Off</span>
                    <span className="text-xs text-muted-foreground">
                      e.g. $10 off original price
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="saleValue">{getSaleValueLabel()}</Label>
            <Input
              id="saleValue"
              type="number"
              step={saleType === "percent" ? "1" : "0.01"}
              min="0"
              max={saleType === "percent" ? "100" : undefined}
              value={saleValue}
              onChange={(e) => setSaleValue(e.target.value)}
              placeholder={getSaleValuePlaceholder()}
              disabled={isLoading}
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label>Start Date & Time</Label>
              <DateTimePicker
                value={startDate}
                onChange={setStartDate}
                disabled={isLoading}
                minDate={new Date()}
                placeholder="Sale starts"
              />
            </div>

            <div className="space-y-2">
              <Label>End Date & Time</Label>
              <DateTimePicker
                value={endDate}
                onChange={setEndDate}
                disabled={isLoading}
                minDate={startDate || new Date()}
                placeholder="Sale ends"
              />
            </div>
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
                  ? "Update Sale"
                  : "Schedule Sale"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

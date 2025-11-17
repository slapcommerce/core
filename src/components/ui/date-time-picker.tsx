import * as React from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { IconCalendar, IconClock } from "@tabler/icons-react";

interface DateTimePickerProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
  minDate?: Date;
  className?: string;
}

// Generate hours (00-23)
const hours = Array.from({ length: 24 }, (_, i) =>
  i.toString().padStart(2, "0"),
);

// Generate minutes (00-59)
const minutes = [
  "00",
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "30",
  "31",
  "32",
  "33",
  "34",
  "35",
  "36",
  "37",
  "38",
  "39",
  "40",
  "41",
  "42",
  "43",
  "44",
  "45",
  "46",
  "47",
  "48",
  "49",
  "50",
  "51",
  "52",
  "53",
  "54",
  "55",
  "56",
  "57",
  "58",
  "59",
];

export function DateTimePicker({
  value,
  onChange,
  disabled = false,
  placeholder = "Select date and time",
  minDate,
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedHour, setSelectedHour] = React.useState<string>(
    value ? format(value, "HH") : "12",
  );
  const [selectedMinute, setSelectedMinute] = React.useState<string>(
    value ? format(value, "mm") : "00",
  );

  // Update time values when date changes externally
  React.useEffect(() => {
    if (value) {
      setSelectedHour(format(value, "HH"));
      setSelectedMinute(format(value, "mm"));
    }
  }, [value]);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) {
      onChange(undefined);
      return;
    }

    // Create new date with selected date and current time
    const newDate = new Date(selectedDate);
    newDate.setHours(parseInt(selectedHour), parseInt(selectedMinute), 0, 0);

    onChange(newDate);
    setOpen(false);
  };

  const handleHourChange = (hour: string) => {
    setSelectedHour(hour);

    // If we have a date selected, update it with the new time
    if (value) {
      const newDate = new Date(value);
      newDate.setHours(parseInt(hour), parseInt(selectedMinute), 0, 0);
      onChange(newDate);
    } else {
      // If no date selected yet, create one for today with the selected time
      const newDate = new Date();
      newDate.setHours(parseInt(hour), parseInt(selectedMinute), 0, 0);
      onChange(newDate);
    }
  };

  const handleMinuteChange = (minute: string) => {
    setSelectedMinute(minute);

    // If we have a date selected, update it with the new time
    if (value) {
      const newDate = new Date(value);
      newDate.setHours(parseInt(selectedHour), parseInt(minute), 0, 0);
      onChange(newDate);
    } else {
      // If no date selected yet, create one for today with the selected time
      const newDate = new Date();
      newDate.setHours(parseInt(selectedHour), parseInt(minute), 0, 0);
      onChange(newDate);
    }
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div>
        <Label className="text-sm font-medium mb-2 block">Date</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !value && "text-muted-foreground",
              )}
              disabled={disabled}
            >
              <IconCalendar className="mr-2 h-4 w-4" />
              {value ? format(value, "PPP") : <span>Select date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={value}
              onSelect={handleDateSelect}
              disabled={(date) => {
                if (minDate) {
                  return date < minDate;
                }
                return false;
              }}
              autoFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <Label className="text-sm font-medium mb-2 block">Time</Label>
        <div className="flex gap-2">
          <Select
            value={selectedHour}
            onValueChange={handleHourChange}
            disabled={disabled}
          >
            <SelectTrigger className="flex-1">
              <div className="flex items-center gap-2">
                <IconClock className="h-4 w-4" />
                <SelectValue placeholder="HH" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {hours.map((hour) => (
                <SelectItem key={hour} value={hour}>
                  {hour}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="flex items-center text-muted-foreground">:</span>

          <Select
            value={selectedMinute}
            onValueChange={handleMinuteChange}
            disabled={disabled}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="MM" />
            </SelectTrigger>
            <SelectContent>
              {minutes.map((minute) => (
                <SelectItem key={minute} value={minute}>
                  {minute}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

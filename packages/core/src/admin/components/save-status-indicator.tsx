import * as React from "react";
import { IconCheck, IconLoader2, IconAlertCircle } from "@tabler/icons-react";
import { useSaveStatus } from "@/admin/contexts/save-status-context";
import { cn } from "@/admin/lib/utils";

export function SaveStatusIndicator() {
  const { status } = useSaveStatus();
  const [isVisible, setIsVisible] = React.useState(false);

  // Show/hide animation
  React.useEffect(() => {
    if (status === "saving" || status === "saved" || status === "error") {
      setIsVisible(true);
    } else {
      // Delay hiding to allow fade-out animation
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [status]);

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200",
        (!isVisible || status === "idle") && "opacity-0 scale-95 bg-zen-moss/15 text-zen-moss dark:bg-zen-moss/20 dark:text-zen-moss",
        status === "saving" && "opacity-100 scale-100 bg-muted text-muted-foreground",
        status === "saved" && "opacity-100 scale-100 bg-zen-moss/15 text-zen-moss dark:bg-zen-moss/20 dark:text-zen-moss",
        status === "error" && "opacity-100 scale-100 bg-destructive/10 text-destructive"
      )}
    >
      {status === "saving" && (
        <>
          <IconLoader2 className="size-4 animate-spin" />
          <span>Saving...</span>
        </>
      )}
      {status === "saved" && (
        <>
          <IconCheck className="size-4 font-bold" />
          <span>Saved</span>
        </>
      )}
      {status === "error" && (
        <>
          <IconAlertCircle className="size-4" />
          <span>Failed to save</span>
        </>
      )}
      {/* Reserve space when idle */}
      {status === "idle" && (
        <>
          <IconCheck className="size-4 font-bold" />
          <span>Saved</span>
        </>
      )}
    </div>
  );
}

import * as React from "react";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface SaveStatusContextValue {
  status: SaveStatus;
  startSaving: () => void;
  completeSave: () => void;
  failSave: () => void;
}

const SaveStatusContext = React.createContext<SaveStatusContextValue | undefined>(
  undefined
);

export function SaveStatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<SaveStatus>("idle");
  const [activeOperations, setActiveOperations] = React.useState(0);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingStartTimeRef = React.useRef<number | null>(null);

  const startSaving = React.useCallback(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Record when saving started
    if (savingStartTimeRef.current === null) {
      savingStartTimeRef.current = Date.now();
    }

    setActiveOperations((prev) => prev + 1);
    setStatus("saving");
  }, []);

  const completeSave = React.useCallback(() => {
    setActiveOperations((prev) => {
      const newCount = Math.max(0, prev - 1);

      // Only show "saved" if no more operations are active
      if (newCount === 0) {
        // Calculate elapsed time and ensure minimum display of 400ms for "Saving..."
        const elapsed = savingStartTimeRef.current
          ? Date.now() - savingStartTimeRef.current
          : 0;
        const minimumDelay = Math.max(0, 400 - elapsed);

        // Delay showing "Saved" if save completed too quickly
        timeoutRef.current = setTimeout(() => {
          setStatus("saved");
          savingStartTimeRef.current = null;

          // Auto-hide "Saved" after 3.5 seconds
          timeoutRef.current = setTimeout(() => {
            setStatus("idle");
            timeoutRef.current = null;
          }, 3500);
        }, minimumDelay);
      }

      return newCount;
    });
  }, []);

  const failSave = React.useCallback(() => {
    setActiveOperations((prev) => {
      const newCount = Math.max(0, prev - 1);

      // Show error briefly, then return to idle
      if (newCount === 0) {
        setStatus("error");

        timeoutRef.current = setTimeout(() => {
          setStatus("idle");
          timeoutRef.current = null;
        }, 3500);
      }

      return newCount;
    });
  }, []);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const value = React.useMemo(
    () => ({ status, startSaving, completeSave, failSave }),
    [status, startSaving, completeSave, failSave]
  );

  return (
    <SaveStatusContext.Provider value={value}>
      {children}
    </SaveStatusContext.Provider>
  );
}

export function useSaveStatus() {
  const context = React.useContext(SaveStatusContext);
  if (!context) {
    throw new Error("useSaveStatus must be used within SaveStatusProvider");
  }
  return context;
}

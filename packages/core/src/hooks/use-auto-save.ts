import { useRef, useCallback, useEffect } from "react";

/**
 * Custom hook for hybrid autosave (debounced + immediate)
 *
 * Provides two save strategies:
 * - debouncedSave: Saves after a delay (default 1000ms) when user stops typing
 * - immediateSave: Cancels any pending save and saves immediately (for blur/Enter)
 *
 * @param value - Current value to save
 * @param onSave - Async function to persist the value
 * @param debounceMs - Milliseconds to wait after typing stops (default: 1000)
 */
export function useAutoSave<T>(
  value: T,
  onSave: (value: T) => Promise<void>,
  debounceMs = 1000
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const debouncedSave = useCallback((val: T) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout to save after debounce delay
    timeoutRef.current = setTimeout(() => {
      onSave(val);
    }, debounceMs);
  }, [onSave, debounceMs]);

  const immediateSave = useCallback(() => {
    // Cancel any pending debounced save
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }

    // Save immediately
    onSave(value);
  }, [onSave, value]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { debouncedSave, immediateSave };
}

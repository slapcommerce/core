/**
 * Creates an auto-save controller with debounced and immediate save capabilities.
 *
 * @param onSave - Async function to persist the value
 * @param debounceMs - Milliseconds to wait after typing stops (default: 1000)
 * @returns Object with debouncedSave and immediateSave functions
 */
export function createAutoSave<T>(
  onSave: (value: T) => Promise<void>,
  debounceMs = 1000
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let latestValue: T | undefined;

  function debouncedSave(value: T) {
    // Clear any existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Store the latest value
    latestValue = value;

    // Set new timeout to save after debounce delay
    timeoutId = setTimeout(() => {
      onSave(value);
      timeoutId = undefined;
    }, debounceMs);
  }

  function immediateSave() {
    // Cancel any pending debounced save
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }

    // Save immediately using the latest value
    if (latestValue !== undefined) {
      onSave(latestValue);
    }
  }

  function cancel() {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
  }

  function cleanup() {
    cancel();
    latestValue = undefined;
  }

  return {
    debouncedSave,
    immediateSave,
    cancel,
    cleanup
  };
}

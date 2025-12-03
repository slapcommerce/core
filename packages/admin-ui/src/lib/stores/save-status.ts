import { writable, derived } from 'svelte/store';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface SaveStatusState {
  status: SaveStatus;
  activeOperations: number;
}

function createSaveStatusStore() {
  const { subscribe, update } = writable<SaveStatusState>({
    status: 'idle',
    activeOperations: 0
  });

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let savingStartTime: number | null = null;

  function clearTimeouts() {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  return {
    subscribe,

    startSaving() {
      clearTimeouts();

      if (savingStartTime === null) {
        savingStartTime = Date.now();
      }

      update(state => ({
        status: 'saving',
        activeOperations: state.activeOperations + 1
      }));
    },

    completeSave() {
      update(state => {
        const newCount = Math.max(0, state.activeOperations - 1);

        if (newCount === 0) {
          // Calculate elapsed time and ensure minimum display of 400ms for "Saving..."
          const elapsed = savingStartTime ? Date.now() - savingStartTime : 0;
          const minimumDelay = Math.max(0, 400 - elapsed);

          // Delay showing "Saved" if save completed too quickly
          timeoutId = setTimeout(() => {
            update(s => ({ ...s, status: 'saved' }));
            savingStartTime = null;

            // Auto-hide "Saved" after 3.5 seconds
            timeoutId = setTimeout(() => {
              update(s => ({ ...s, status: 'idle' }));
              timeoutId = null;
            }, 3500);
          }, minimumDelay);
        }

        return { ...state, activeOperations: newCount };
      });
    },

    failSave() {
      update(state => {
        const newCount = Math.max(0, state.activeOperations - 1);

        if (newCount === 0) {
          // Show error briefly, then return to idle
          timeoutId = setTimeout(() => {
            update(s => ({ ...s, status: 'idle' }));
            timeoutId = null;
          }, 3500);

          return { status: 'error', activeOperations: newCount };
        }

        return { ...state, activeOperations: newCount };
      });
    },

    reset() {
      clearTimeouts();
      savingStartTime = null;
      update(() => ({ status: 'idle', activeOperations: 0 }));
    }
  };
}

export const saveStatusStore = createSaveStatusStore();
export const saveStatus = derived(saveStatusStore, $store => $store.status);

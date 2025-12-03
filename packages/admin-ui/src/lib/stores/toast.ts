import { writable, derived } from 'svelte/store';

export type ToastType = 'default' | 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
}

function createToastStore() {
  const { subscribe, update } = writable<ToastState>({ toasts: [] });

  let idCounter = 0;

  function generateId(): string {
    return `toast-${++idCounter}-${Date.now()}`;
  }

  function addToast(message: string, type: ToastType = 'default', duration = 5000): string {
    const id = generateId();

    update(state => ({
      toasts: [...state.toasts, { id, type, message, duration }]
    }));

    // Auto-dismiss after duration
    if (duration > 0) {
      setTimeout(() => {
        dismiss(id);
      }, duration);
    }

    return id;
  }

  function dismiss(id: string) {
    update(state => ({
      toasts: state.toasts.filter(t => t.id !== id)
    }));
  }

  function dismissAll() {
    update(() => ({ toasts: [] }));
  }

  return {
    subscribe,

    // Shorthand methods
    default: (message: string, duration?: number) => addToast(message, 'default', duration),
    success: (message: string, duration?: number) => addToast(message, 'success', duration),
    error: (message: string, duration?: number) => addToast(message, 'error', duration),
    warning: (message: string, duration?: number) => addToast(message, 'warning', duration),
    info: (message: string, duration?: number) => addToast(message, 'info', duration),

    dismiss,
    dismissAll
  };
}

export const toast = createToastStore();
export const toasts = derived(toast, $store => $store.toasts);

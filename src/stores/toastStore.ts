import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info';

interface ToastState {
  message: string | null;
  variant: ToastVariant;
  show: (message: string, variant?: ToastVariant) => void;
  hide: () => void;
}

let dismissTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  variant: 'success',

  show: (message, variant = 'success') => {
    if (dismissTimer) clearTimeout(dismissTimer);
    set({ message, variant });
    dismissTimer = setTimeout(() => set({ message: null }), 3200);
  },

  hide: () => {
    if (dismissTimer) clearTimeout(dismissTimer);
    set({ message: null });
  },
}));

/** Imperative helpers — safe to call from event handlers anywhere. */
export const toast = {
  success: (message: string) => useToastStore.getState().show(message, 'success'),
  error: (message: string) => useToastStore.getState().show(message, 'error'),
  info: (message: string) => useToastStore.getState().show(message, 'info'),
};

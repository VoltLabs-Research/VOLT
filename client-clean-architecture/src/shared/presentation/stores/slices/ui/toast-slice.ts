import type { StateCreator } from 'zustand';

export type ToastType = 'error' | 'success' | 'warning' | 'info';

export interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
    createdAt: number;
}

export interface ToastState {
    toasts: Toast[];
}

export interface ToastActions {
    addToast: (message: string, type: ToastType, duration?: number) => string;
    removeToast: (id: string) => void;
    updateToast: (id: string, updates: Partial<Toast>) => void;
    clearAllToasts: () => void;
}

export type ToastSlice = ToastState & ToastActions;

const initialState: ToastState = {
    toasts: []
};

export const createToastSlice: StateCreator<any, [], [], ToastSlice> = (set, get) => ({
    ...initialState,

    addToast: (message: string, type: ToastType, duration = 5000) => {
        const id = `toast-${Date.now()}-${Math.random()}`;
        const toast: Toast = { id, type, message, duration, createdAt: Date.now() };

        set((state: ToastSlice) => ({ toasts: [...state.toasts, toast] }));

        if (duration > 0) {
            setTimeout(() => {
                get().removeToast(id);
            }, duration);
        }
        return id;
    },

    updateToast: (id: string, updates: Partial<Toast>) => {
        set((state: ToastSlice) => ({
            toasts: state.toasts.map((t: Toast) =>
                t.id === id ? { ...t, ...updates } : t
            )
        }));
    },

    removeToast: (id: string) => {
        set((state: ToastSlice) => ({
            toasts: state.toasts.filter((t: Toast) => t.id !== id)
        }));
    },

    clearAllToasts: () => {
        set({ toasts: [] });
    }
});

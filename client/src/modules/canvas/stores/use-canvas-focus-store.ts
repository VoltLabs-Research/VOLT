import { create } from 'zustand';

interface CanvasFocusState {
    focusedModifierId: string | null;
    focusModifier: (modifierId: string) => void;
    clearFocusedModifier: () => void;
}

export const useCanvasFocusStore = create<CanvasFocusState>((set) => ({
    focusedModifierId: null,
    focusModifier: (modifierId) => set({ focusedModifierId: modifierId }),
    clearFocusedModifier: () => set({ focusedModifierId: null })
}));

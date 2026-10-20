import { create } from 'zustand';

interface CommandPaletteState {
    isOpen: boolean;
}

interface CommandPaletteActions {
    open: () => void;
    close: () => void;
    toggle: () => void;
}

export const useCommandPaletteStore = create<CommandPaletteState & CommandPaletteActions>((set) => ({
    isOpen: false,
    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false }),
    toggle: () => set((state) => ({ isOpen: !state.isOpen }))
}));

import { create } from 'zustand';

interface ChatSurfaceState {
    isWidgetOpen: boolean;
    openWidget: () => void;
    closeWidget: () => void;
    toggleWidget: () => void;
}

export const useChatSurfaceStore = create<ChatSurfaceState>((set) => ({
    isWidgetOpen: false,
    openWidget: () => set({ isWidgetOpen: true }),
    closeWidget: () => set({ isWidgetOpen: false }),
    toggleWidget: () => set((state) => ({ isWidgetOpen: !state.isWidgetOpen }))
}));

import { create } from 'zustand';

/**
 * Global chat-surface state — lets the AI (via the `set_chat_surface` client
 * tool) and the UI move the assistant between the floating widget and the full
 * page. The widget's open flag used to be local `useState` in
 * AIFloatingAssistantPanel; lifting it here makes it AI-addressable.
 *
 * NOTE: this controls WHICH surface is shown, not a single shared stream
 * instance. The full-page surface (/dashboard/ai) and the widget still own
 * their own useChat instances and each hydrate the active conversation from the
 * server. Seamless mid-stream continuity across surfaces (one hoisted useChat)
 * is a deliberate follow-up; this store is the safe, regression-free first step.
 */

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

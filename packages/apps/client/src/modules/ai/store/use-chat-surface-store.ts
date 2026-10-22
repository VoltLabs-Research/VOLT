import { create } from 'zustand';
import type { AITableArtifact } from '@/modules/ai/contracts/artifacts';

export const NEW_CONVERSATION_DRAFT = 'new';

// A conversation is addressed under the team that owns it, which stops being the selected team as
// soon as the user (or the assistant) switches team.
export interface ActiveConversation {
    conversationId: string;
    teamId: string;
}

interface PendingTurn {
    conversationId: string;
    text: string;
}

interface ChatSurfaceState {
    isWidgetOpen: boolean;
    // The conversation the floating panel shows, and the one the AI page last showed: leaving the
    // page hands it to the panel.
    active: ActiveConversation | null;
    drafts: Record<string, string>;
    pendingTurn: PendingTurn | null;
    artifact: AITableArtifact | null;
    openWidget: () => void;
    closeWidget: () => void;
    toggleWidget: () => void;
    setActive: (active: ActiveConversation | null) => void;
    setDraft: (key: string, text: string) => void;
    queueTurn: (turn: PendingTurn) => void;
    takeTurn: (conversationId: string) => string | null;
    showArtifact: (artifact: AITableArtifact) => void;
    closeArtifact: () => void;
}

export const useChatSurfaceStore = create<ChatSurfaceState>((set, get) => ({
    isWidgetOpen: false,
    active: null,
    drafts: {},
    pendingTurn: null,
    artifact: null,
    openWidget: () => set({ isWidgetOpen: true }),
    closeWidget: () => set({ isWidgetOpen: false }),
    toggleWidget: () => set((state) => ({ isWidgetOpen: !state.isWidgetOpen })),
    setActive: (active) => {
        const current = get().active;
        if (current?.conversationId === active?.conversationId && current?.teamId === active?.teamId) return;

        set({ active });
    },
    setDraft: (key, text) => set((state) => ({
        drafts: {
            ...state.drafts,
            [key]: text
        }
    })),
    queueTurn: (turn) => set({ pendingTurn: turn }),
    takeTurn: (conversationId) => {
        const pending = get().pendingTurn;
        if (pending === null || pending.conversationId !== conversationId) return null;

        set({ pendingTurn: null });
        return pending.text;
    },
    showArtifact: (artifact) => set({ artifact }),
    closeArtifact: () => set({ artifact: null })
}));

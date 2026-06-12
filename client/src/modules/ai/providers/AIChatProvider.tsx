import useAIPage from '@/modules/ai/hooks/use-ai-page';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

const PENDING_MESSAGE_STORAGE_KEY = 'volt:ai:pending-message';

/**
 * Hoisted AI chat state.
 *
 * Before this, the floating widget and the full AI page each called
 * `useAIPage` independently — two separate `useChat` instances. Switching
 * surfaces unmounted one, and its unmount `stop()` aborted any in-flight
 * stream. By calling `useAIPage` ONCE here, inside a provider mounted by the
 * persistent DashboardLayout, the single `useChat`/`Chat` instance (and its
 * live stream) survives moving between the widget, the page, and the canvas —
 * it only tears down when the user leaves the dashboard entirely.
 *
 * `activeConversationId` is the single source of truth for which conversation
 * is shown. The AI page keeps the URL in sync with it (see AIPage); the widget
 * just reads/sets it without navigating.
 */

type AIPageState = ReturnType<typeof useAIPage>;

interface AIChatContextValue extends AIPageState {
    activeConversationId?: string;
    setActiveConversationId: (conversationId?: string) => void;
    messageDraft: string;
    setMessageDraft: (draft: string) => void;
    /** Sends the current draft, creating a conversation first when needed. */
    handleSend: () => Promise<void>;
    /** Sends an explicit prompt (e.g. an empty-state suggestion) directly. */
    sendPrompt: (prompt: string) => Promise<void>;
}

const AIChatContext = createContext<AIChatContextValue | null>(null);

export const AIChatProvider = ({ children }: { children: ReactNode }) => {
    const [activeConversationId, setActiveConversationId] = useState<string | undefined>();
    const [messageDraft, setMessageDraft] = useState('');

    const pageState = useAIPage(activeConversationId, {
        navigateOnConversationChange: false,
        onConversationChange: setActiveConversationId
    });

    const { handleSendMessage, handleCreateConversation, canSendMessage } = pageState;

    // Consolidated pending-message flow (previously duplicated in AIPage and the
    // widget panel). When the user sends from the empty/draft state, we stash
    // the text, create the conversation, then flush it once the conversation id
    // and provider readiness arrive.
    useEffect(() => {
        if (!activeConversationId || !canSendMessage) {
            return;
        }

        const pending = sessionStorage.getItem(PENDING_MESSAGE_STORAGE_KEY);
        if (!pending) {
            return;
        }

        sessionStorage.removeItem(PENDING_MESSAGE_STORAGE_KEY);
        handleSendMessage(pending).catch(() => {
            sessionStorage.setItem(PENDING_MESSAGE_STORAGE_KEY, pending);
            setMessageDraft(pending);
        });
    }, [activeConversationId, canSendMessage, handleSendMessage]);

    const handleSend = useCallback(async () => {
        const draftToSend = messageDraft.trim();
        if (!draftToSend) {
            return;
        }

        setMessageDraft('');
        try {
            if (!activeConversationId) {
                sessionStorage.setItem(PENDING_MESSAGE_STORAGE_KEY, draftToSend);
                await handleCreateConversation(draftToSend);
                return;
            }

            await handleSendMessage(draftToSend);
        } catch {
            // Restore the draft so the user doesn't lose their text on failure.
            setMessageDraft(draftToSend);
        }
    }, [activeConversationId, handleCreateConversation, handleSendMessage, messageDraft]);

    const sendPrompt = useCallback(async (prompt: string) => {
        const text = prompt.trim();
        if (!text) {
            return;
        }

        try {
            if (!activeConversationId) {
                sessionStorage.setItem(PENDING_MESSAGE_STORAGE_KEY, text);
                await handleCreateConversation(text);
                return;
            }

            await handleSendMessage(text);
        } catch {
            setMessageDraft(text);
        }
    }, [activeConversationId, handleCreateConversation, handleSendMessage]);

    const value = useMemo<AIChatContextValue>(() => ({
        ...pageState,
        activeConversationId,
        setActiveConversationId,
        messageDraft,
        setMessageDraft,
        handleSend,
        sendPrompt
    }), [pageState, activeConversationId, messageDraft, handleSend, sendPrompt]);

    return (
        <AIChatContext.Provider value={value}>
            {children}
        </AIChatContext.Provider>
    );
};

/**
 * Consumes the hoisted AI chat state. Throws if used outside the provider so a
 * missing mount is caught immediately rather than silently splitting state.
 */
export const useAIChatContext = (): AIChatContextValue => {
    const context = useContext(AIChatContext);
    if (!context) {
        throw new Error('useAIChatContext must be used within an AIChatProvider');
    }
    return context;
};

/** Optional variant for surfaces that may render before the provider mounts. */
export const useOptionalAIChatContext = (): AIChatContextValue | null => {
    return useContext(AIChatContext);
};

// Re-exported so callers (e.g. AIPage URL sync) share the exact storage key.
export { PENDING_MESSAGE_STORAGE_KEY };

export type { AIChatContextValue };

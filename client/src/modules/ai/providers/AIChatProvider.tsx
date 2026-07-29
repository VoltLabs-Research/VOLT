import useAIPage from '@/modules/ai/hooks/use-ai-page';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

const PENDING_MESSAGE_STORAGE_KEY = 'volt:ai:pending-message';

type AIPageState = ReturnType<typeof useAIPage>;

interface AIChatContextValue extends AIPageState {
    activeConversationId?: string;
    setActiveConversationId: (conversationId?: string) => void;
    messageDraft: string;
    setMessageDraft: (draft: string) => void;
    
    handleSend: () => Promise<void>;
    
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

export const useAIChatContext = (): AIChatContextValue => {
    const context = useContext(AIChatContext);
    if (!context) {
        throw new Error('useAIChatContext must be used within an AIChatProvider');
    }
    return context;
};

export { PENDING_MESSAGE_STORAGE_KEY };

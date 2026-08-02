import useAIPage from '@/modules/ai/hooks/use-ai-page';
import useConversationPanelView from '@/modules/ai/components/AIConversationPanelContent/use-conversation-panel-view';
import { PENDING_MESSAGE_STORAGE_KEY } from '@/modules/ai/providers/AIChatProvider';
import { useCallback, useEffect, useState } from 'react';

interface UseAIConversationPanelOptions {
    normalizeDraft?: (draft: string) => string;
    prepareMessage?: (draft: string) => string;
    onNavigateAway?: () => void;
}

/** Embedded assistant panel with its own conversation, scoped to the surface that mounts it. */
const useAIConversationPanel = ({
    normalizeDraft,
    prepareMessage,
    onNavigateAway
}: UseAIConversationPanelOptions = {}) => {
    const [conversationId, setConversationId] = useState<string | undefined>();
    const [messageDraft, setMessageDraft] = useState('');

    const pageState = useAIPage(conversationId, {
        navigateOnConversationChange: false,
        onConversationChange: setConversationId
    });

    const { handleCreateConversation, handleSendMessage } = pageState;

    useEffect(() => {
        if (!conversationId) return;

        const pendingMessage = sessionStorage.getItem(PENDING_MESSAGE_STORAGE_KEY);
        if (!pendingMessage) return;

        sessionStorage.removeItem(PENDING_MESSAGE_STORAGE_KEY);

        handleSendMessage(pendingMessage).catch(() => {
            sessionStorage.setItem(PENDING_MESSAGE_STORAGE_KEY, pendingMessage);
            setMessageDraft(pendingMessage);
        });
    }, [conversationId, handleSendMessage]);

    const handleSend = useCallback(async () => {
        const draftToSend = normalizeDraft ? normalizeDraft(messageDraft) : messageDraft;

        if (!draftToSend.trim()) {
            return;
        }

        setMessageDraft('');
        try {
            const preparedMessage = prepareMessage ? prepareMessage(draftToSend) : draftToSend;

            if (!conversationId) {
                sessionStorage.setItem(PENDING_MESSAGE_STORAGE_KEY, preparedMessage);
                await handleCreateConversation(draftToSend);
                return;
            }

            await handleSendMessage(preparedMessage);
        } catch {
            setMessageDraft(draftToSend);
        }
    }, [conversationId, handleCreateConversation, handleSendMessage, messageDraft, normalizeDraft, prepareMessage]);

    const panelView = useConversationPanelView({
        pageState,
        conversationId,
        messageDraft,
        setMessageDraft,
        handleSend,
        onNavigateAway
    });

    return {
        ...panelView,
        resetConversationState: () => {
            setConversationId(undefined);
            setMessageDraft('');
        }
    };
};

export default useAIConversationPanel;

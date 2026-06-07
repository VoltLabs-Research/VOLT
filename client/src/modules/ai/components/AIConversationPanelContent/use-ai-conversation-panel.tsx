import AIConversationPanelContent from '@/modules/ai/components/AIConversationPanelContent';
import useAIPage from '@/modules/ai/hooks/use-ai-page';
import { toAIModelSelectOptions } from '@/modules/ai/utilities/model-options';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AIMessageArtifact } from '@/modules/ai/api/entities/ai-conversation';
import type { SelectOption } from '@voltstack/bravais';
import { useNavigate } from 'react-router-dom';

const PENDING_MESSAGE_STORAGE_KEY = 'volt:ai:pending-message';

interface PrepareMessageContext {
    conversationId?: string;
}

interface UseAIConversationPanelOptions {
    normalizeDraft?: (draft: string) => string;
    prepareMessage?: (draft: string, context: PrepareMessageContext) => string;
    onNavigateAway?: () => void;
}

const preserveDraft = (draft: string) => draft;

const useAIConversationPanel = (options: UseAIConversationPanelOptions = {}) => {
    const {
        normalizeDraft = preserveDraft,
        prepareMessage = preserveDraft,
        onNavigateAway
    } = options;
    const navigate = useNavigate();
    const [conversationId, setConversationId] = useState<string | undefined>();
    const [messageDraft, setMessageDraft] = useState('');

    const {
        selectedTeam,
        messages,
        conversations,
        availableModelsForProvider,
        selectedModel,
        isMessagesLoading,
        isProviderCatalogLoading,
        isSendingMessage,
        conversationsError,
        messagesError,
        providerCatalogError,
        sendMessageError,
        noProviderConfigured,
        canSendMessage,
        accessDenied,
        accessDeniedMessage,
        loadConversations,
        loadProviderCatalog,
        setSelectedModel,
        handleSelectConversation,
        handleCreateConversation,
        addToolApprovalResponse,
        handleSendMessage,
        loadConversationMessages,
        isConversationsLoading
    } = useAIPage(conversationId, {
        navigateOnConversationChange: false,
        onConversationChange: setConversationId
    });

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

    const conversationOptions: SelectOption[] = useMemo(() => {
        return conversations.map((conversation) => ({
            value: conversation._id,
            title: conversation.title || 'Untitled Conversation',
            description: conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleString() : undefined
        }));
    }, [conversations]);

    const modelOptions = useMemo(() => toAIModelSelectOptions(availableModelsForProvider), [availableModelsForProvider]);

    const handleSend = useCallback(async () => {
        const draftToSend = normalizeDraft(messageDraft);

        if (!draftToSend.trim()) {
            return;
        }

        setMessageDraft('');
        try {
            const preparedMessage = prepareMessage(draftToSend, { conversationId });

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

    const handleOpenTableArtifact = useCallback((artifact: AIMessageArtifact) => {
        if (!conversationId) {
            return;
        }

        navigate(`/dashboard/ai/${conversationId}?artifactId=${encodeURIComponent(artifact.id)}`);
        onNavigateAway?.();
    }, [conversationId, navigate, onNavigateAway]);

    const openAIPage = useCallback(() => {
        const targetPath = conversationId
            ? `/dashboard/ai/${conversationId}`
            : '/dashboard/ai';

        navigate(targetPath);
        onNavigateAway?.();
    }, [conversationId, navigate, onNavigateAway]);

    const handleRetry = useCallback(() => {
        if (conversationId) {
            loadConversationMessages(conversationId).catch(console.warn);
        }
    }, [conversationId, loadConversationMessages]);

    const resetConversationState = useCallback(() => {
        setConversationId(undefined);
        setMessageDraft('');
    }, []);

    const openIntegrations = useCallback(() => {
        navigate('/dashboard/settings/integrations');
    }, [navigate]);

    const conversationPanelContent = (
        <AIConversationPanelContent
            conversationId={conversationId}
            messages={messages}
            isMessagesLoading={isMessagesLoading}
            isSendingMessage={isSendingMessage}
            messagesError={messagesError}
            messageDraft={messageDraft}
            modelOptions={modelOptions}
            selectedModel={selectedModel}
            canSendMessage={canSendMessage}
            isProviderCatalogLoading={isProviderCatalogLoading}
            noProviderConfigured={noProviderConfigured}
            sendMessageError={sendMessageError}
            selectedTeamId={selectedTeam?._id}
            accessDenied={accessDenied}
            accessDeniedMessage={accessDeniedMessage}
            addToolApprovalResponse={addToolApprovalResponse}
            onMessageDraftChange={setMessageDraft}
            onModelChange={setSelectedModel}
            onSend={handleSend}
            onOpenTableArtifact={handleOpenTableArtifact}
            onRetry={handleRetry}
            onOpenIntegrations={openIntegrations}
        />
    );

    return {
        conversationId,
        conversationOptions,
        conversationPanelContent,
        conversationsError,
        handleCreateConversation,
        handleSelectConversation,
        isConversationsLoading,
        isProviderCatalogLoading,
        loadConversations,
        loadProviderCatalog,
        noProviderConfigured,
        openAIPage,
        providerCatalogError,
        resetConversationState
    };
};

export default useAIConversationPanel;

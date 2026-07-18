import AIConversationPanelContent from '@/modules/ai/components/AIConversationPanelContent';
import { useAIChatContext } from '@/modules/ai/providers/AIChatProvider';
import { toAIModelSelectOptions } from '@/modules/ai/utilities/model-options';
import { useCallback, useMemo } from 'react';
import type { AIMessageArtifact } from '@/modules/ai/api/types/ai-conversation';
import type { SelectOption } from '@voltstack/bravais';
import { useNavigate } from 'react-router-dom';

interface UseSharedAIConversationPanelOptions {
    onNavigateAway?: () => void;
}

const useSharedAIConversationPanel = (options: UseSharedAIConversationPanelOptions = {}) => {
    const { onNavigateAway } = options;
    const navigate = useNavigate();

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
        loadConversationMessages,
        isConversationsLoading,
        activeConversationId,
        messageDraft,
        setMessageDraft,
        handleSend,
        stopStreaming
    } = useAIChatContext();

    const conversationOptions: SelectOption[] = useMemo(() => {
        return conversations.map((conversation) => ({
            value: conversation._id,
            title: conversation.title || 'Untitled Conversation',
            description: conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleString() : undefined
        }));
    }, [conversations]);

    const modelOptions = useMemo(() => toAIModelSelectOptions(availableModelsForProvider), [availableModelsForProvider]);

    const handleOpenTableArtifact = useCallback((artifact: AIMessageArtifact) => {
        if (!activeConversationId) {
            return;
        }

        navigate(`/dashboard/ai/${activeConversationId}?artifactId=${encodeURIComponent(artifact.id)}`);
        onNavigateAway?.();
    }, [activeConversationId, navigate, onNavigateAway]);

    const openAIPage = useCallback(() => {
        const targetPath = activeConversationId
            ? `/dashboard/ai/${activeConversationId}`
            : '/dashboard/ai';

        navigate(targetPath);
        onNavigateAway?.();
    }, [activeConversationId, navigate, onNavigateAway]);

    const handleRetry = useCallback(() => {
        if (activeConversationId) {
            loadConversationMessages(activeConversationId).catch(console.warn);
        }
    }, [activeConversationId, loadConversationMessages]);

    const openIntegrations = useCallback(() => {
        navigate('/dashboard/settings/integrations');
    }, [navigate]);

    const conversationPanelContent = (
        <AIConversationPanelContent
            conversationId={activeConversationId}
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
            onStop={stopStreaming}
            onOpenTableArtifact={handleOpenTableArtifact}
            onRetry={handleRetry}
            onOpenIntegrations={openIntegrations}
        />
    );

    return {
        conversationId: activeConversationId,
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
        providerCatalogError
    };
};

export default useSharedAIConversationPanel;

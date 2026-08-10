import AIConversationPanelContent from '@/modules/ai/components/AIConversationPanelContent';
import useAIPage from '@/modules/ai/hooks/use-ai-page';
import { toAIModelSelectOptions } from '@/modules/ai/utils/model-options';
import { useCallback, useMemo } from 'react';
import type { AIMessageArtifact } from '@volt/contracts/modules/ai/domain';
import type { AISelectOption } from '@/modules/ai/utils/model-options';
import { useNavigate } from 'react-router-dom';

type AIPageState = ReturnType<typeof useAIPage>;

interface ConversationPanelViewOptions {
    pageState: AIPageState;
    conversationId?: string;
    messageDraft: string;
    setMessageDraft: (draft: string) => void;
    handleSend: () => void;
    onNavigateAway?: () => void;
}

/**
 * Shared wiring for every embedded assistant panel: it turns a chat page state into the select
 * options, navigation callbacks and rendered panel that every embedded panel mounts.
 */
const useConversationPanelView = ({
    pageState,
    conversationId,
    messageDraft,
    setMessageDraft,
    handleSend,
    onNavigateAway
}: ConversationPanelViewOptions) => {
    const navigate = useNavigate();
    const { loadConversationMessages } = pageState;

    const conversationOptions: AISelectOption[] = useMemo(() => {
        return pageState.conversations.map((conversation) => ({
            value: conversation._id,
            title: conversation.title || 'Untitled Conversation',
            description: conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleString() : undefined
        }));
    }, [pageState.conversations]);

    const modelOptions = useMemo(
        () => toAIModelSelectOptions(pageState.availableModelsForProvider),
        [pageState.availableModelsForProvider]
    );

    const handleOpenTableArtifact = useCallback((artifact: AIMessageArtifact) => {
        if (!conversationId) {
            return;
        }

        navigate(`/dashboard/ai/${conversationId}?artifactId=${encodeURIComponent(artifact.id)}`);
        onNavigateAway?.();
    }, [conversationId, navigate, onNavigateAway]);

    const openAIPage = useCallback(() => {
        navigate(conversationId ? `/dashboard/ai/${conversationId}` : '/dashboard/ai');
        onNavigateAway?.();
    }, [conversationId, navigate, onNavigateAway]);

    const handleRetry = useCallback(() => {
        if (conversationId) {
            loadConversationMessages(conversationId).catch(console.warn);
        }
    }, [conversationId, loadConversationMessages]);

    const conversationPanelContent = (
        <AIConversationPanelContent
            conversationId={conversationId}
            messages={pageState.messages}
            isMessagesLoading={pageState.isMessagesLoading}
            isSendingMessage={pageState.isSendingMessage}
            messagesError={pageState.messagesError}
            messageDraft={messageDraft}
            modelOptions={modelOptions}
            selectedModel={pageState.selectedModel}
            canSendMessage={pageState.canSendMessage}
            isProviderCatalogLoading={pageState.isProviderCatalogLoading}
            noProviderConfigured={pageState.noProviderConfigured}
            sendMessageError={pageState.sendMessageError}
            selectedTeamId={pageState.selectedTeam?._id}
            accessDenied={pageState.accessDenied}
            accessDeniedMessage={pageState.accessDeniedMessage}
            addToolApprovalResponse={pageState.addToolApprovalResponse}
            onMessageDraftChange={setMessageDraft}
            onModelChange={pageState.setSelectedModel}
            onSend={handleSend}
            onStop={pageState.stopStreaming}
            onOpenTableArtifact={handleOpenTableArtifact}
            onRetry={handleRetry}
            onOpenIntegrations={() => navigate('/dashboard/settings/integrations')}
        />
    );

    return {
        conversationId,
        conversationOptions,
        conversationPanelContent,
        conversationsError: pageState.conversationsError,
        handleCreateConversation: pageState.handleCreateConversation,
        handleSelectConversation: pageState.handleSelectConversation,
        isConversationsLoading: pageState.isConversationsLoading,
        isProviderCatalogLoading: pageState.isProviderCatalogLoading,
        loadConversations: pageState.loadConversations,
        loadProviderCatalog: pageState.loadProviderCatalog,
        noProviderConfigured: pageState.noProviderConfigured,
        openAIPage,
        providerCatalogError: pageState.providerCatalogError
    };
};

export default useConversationPanelView;

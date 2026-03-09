import useAIChatStream from '@/modules/ai/hooks/use-ai-chat-stream';
import useAIConversationMessages from '@/modules/ai/hooks/use-ai-conversation-messages';
import useAIConversations from '@/modules/ai/hooks/use-ai-conversations';
import useAIModelSelection from '@/modules/ai/hooks/use-ai-model-selection';
import { useSelectedTeam, useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { useRef } from 'react';

interface UseAIPageOptions {
    navigateOnConversationChange?: boolean;
    onConversationChange?: (conversationId?: string) => void;
};

const useAIPage = (conversationId?: string, options: UseAIPageOptions = {}) => {
    const selectedTeam = useSelectedTeam();
    const teamId = useSelectedTeamId();
    const { accessDenied, accessDeniedMessage, checkAccessDeniedError } = useAccessDenied();
    const skipNextMessageLoadRef = useRef(false);

    const modelSelection = useAIModelSelection(teamId);

    const {
        conversationMessages,
        messagesQueryParams,
        messagesResult,
        isMessagesLoading,
        messagesError,
        loadConversationMessages
    } = useAIConversationMessages(teamId, conversationId);

    const conversationsHook = useAIConversations(teamId, conversationId, {
        navigateOnConversationChange: options.navigateOnConversationChange,
        onConversationChange: options.onConversationChange,
        onConversationCreated: () => {
            skipNextMessageLoadRef.current = true;
        },
        checkAccessDeniedError
    });

    const chatStream = useAIChatStream({
        teamId,
        conversationId,
        canSendMessage: modelSelection.canSendMessage,
        selectedModelRef: modelSelection.selectedModelRef,
        conversationMessages,
        messagesQueryParams,
        messagesResult,
        skipNextMessageLoadRef
    });

    return {
        selectedTeam,
        accessDenied,
        accessDeniedMessage,

        // Model selection
        configuredProviderCatalog: modelSelection.configuredProviderCatalog,
        availableModelsForProvider: modelSelection.availableModelsForProvider,
        selectedProvider: modelSelection.selectedProvider,
        selectedModel: modelSelection.selectedModel,
        noProviderConfigured: modelSelection.noProviderConfigured,
        canSendMessage: modelSelection.canSendMessage,
        isProviderCatalogLoading: modelSelection.isProviderCatalogLoading,
        providerCatalogError: modelSelection.providerCatalogError,
        setSelectedProvider: modelSelection.setSelectedProvider,
        setSelectedModel: modelSelection.setSelectedModel,

        // Conversations
        activeConversation: conversationsHook.activeConversation,
        conversations: conversationsHook.conversations,
        isConversationsLoading: conversationsHook.isConversationsLoading,
        conversationsError: conversationsHook.conversationsError,
        loadConversations: conversationsHook.loadConversations,
        handleSelectConversation: conversationsHook.handleSelectConversation,
        handleCreateConversation: conversationsHook.handleCreateConversation,
        handleDeleteConversation: conversationsHook.handleDeleteConversation,
        handleRenameConversation: conversationsHook.handleRenameConversation,

        // Messages
        isMessagesLoading,
        messagesError,
        loadConversationMessages,

        // Chat stream
        messages: chatStream.messages,
        isSendingMessage: chatStream.isSendingMessage,
        sendMessageError: chatStream.sendMessageError,
        handleSendMessage: chatStream.handleSendMessage,
        addToolApprovalResponse: chatStream.addToolApprovalResponse
    };
};

export default useAIPage;

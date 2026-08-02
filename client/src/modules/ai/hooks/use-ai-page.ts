import useAIChatStream from '@/modules/ai/hooks/use-ai-chat-stream';
import useAIConversationMessages from '@/modules/ai/hooks/use-ai-conversation-messages';
import useAIConversations from '@/modules/ai/hooks/use-ai-conversations';
import useAIModelSelection from '@/modules/ai/hooks/use-ai-model-selection';
import { useSelectedTeam, useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useAccessDenied from '@/shared/ui/hooks/use-access-denied';
import { useRef } from 'react';

interface UseAIPageOptions {
    navigateOnConversationChange?: boolean;
    onConversationChange?: (conversationId?: string) => void;
}

const useAIPage = (conversationId?: string, options: UseAIPageOptions = {}) => {
    const selectedTeam = useSelectedTeam();
    const teamId = useSelectedTeamId();
    const { accessDenied, accessDeniedMessage, checkAccessDeniedError } = useAccessDenied();
    const skipNextMessageLoadRef = useRef(false);

    const modelSelection = useAIModelSelection(teamId);
    const conversationMessages = useAIConversationMessages(teamId, conversationId);

    const conversations = useAIConversations(teamId, conversationId, {
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
        conversationMessages: conversationMessages.conversationMessages,
        messagesQueryParams: conversationMessages.messagesQueryParams,
        messagesResult: conversationMessages.messagesResult,
        skipNextMessageLoadRef
    });

    return {
        selectedTeam,
        accessDenied,
        accessDeniedMessage,
        ...modelSelection,
        ...conversationMessages,
        ...conversations,
        ...chatStream
    };
};

export default useAIPage;

import { invalidateConversationMessagesQuery, messagesQuery } from '@/modules/ai/hooks/queries';
import { AIMessageRole } from '@volt/contracts/modules/ai/domain';
import { useCallback, useMemo } from 'react';
import type { AIConversationMessage } from '@/modules/ai/contracts/messages';
import type { ConversationMessagesQueryParams } from '@/modules/ai/hooks/queries';
import type { UIMessage } from 'ai';

const MESSAGES_PAGE = {
    page: 1,
    limit: 200
};

const toQueryParams = (teamId: string, conversationId: string): ConversationMessagesQueryParams => ({
    teamId,
    conversationId,
    params: MESSAGES_PAGE
});

const toUIMessage = (message: AIConversationMessage): UIMessage => {
    let parts = message.parts;

    if (parts.length === 0 && message.content.trim()) {
        parts = [{
            type: 'text',
            text: message.content.trim()
        }];
    }

    return {
        id: message._id,
        role: message.role === AIMessageRole.Assistant ? 'assistant' : 'user',
        parts
    };
};

const useAIConversationMessages = (teamId: string | null, conversationId?: string) => {
    const messagesQueryParams = useMemo(() => {
        if (!teamId || !conversationId) {
            return undefined;
        }

        return toQueryParams(teamId, conversationId);
    }, [teamId, conversationId]);

    const messagesResult = messagesQuery(messagesQueryParams ?? toQueryParams('', ''), {
        enabled: Boolean(messagesQueryParams)
    });

    const conversationMessages = useMemo(() => {
        return (messagesResult.data?.data ?? []).map(toUIMessage);
    }, [messagesResult.data]);

    let messagesError: string | null = null;
    if (messagesResult.error) {
        messagesError = 'Failed to load conversation messages.';
    }

    const loadConversationMessages = useCallback(async (targetConversationId: string) => {
        if (!teamId) {
            return;
        }

        await invalidateConversationMessagesQuery(toQueryParams(teamId, targetConversationId));
    }, [teamId]);

    return {
        conversationMessages,
        messagesQueryParams,
        messagesResult,
        isMessagesLoading: messagesResult.isLoading,
        messagesError,
        loadConversationMessages
    };
};

export default useAIConversationMessages;

import { useCallback, useMemo } from 'react';
import type { UIMessage } from 'ai';
import { buildConversationMessagesQueryParams, invalidateConversationMessagesQuery, messagesQuery } from '@/modules/ai/hooks/queries';
import type { AIConversationMessage } from '@/modules/ai/api/entities/ai-conversation';

const toUIMessage = (message: AIConversationMessage): UIMessage => {
    const parts = Array.isArray(message.parts)
        ? message.parts as UIMessage['parts']
        : [];

    if (parts.length > 0) {
        return {
            id: message._id,
            role: message.role as UIMessage['role'],
            parts
        };
    }

    const fallbackText = message.content.trim();

    return {
        id: message._id,
        role: message.role as UIMessage['role'],
        parts: fallbackText ? [{ type: 'text', text: fallbackText }] : []
    };
};

const useAIConversationMessages = (teamId: string | null, conversationId?: string) => {
    const fallbackMessagesQueryParams = useMemo(() => buildConversationMessagesQueryParams('', ''), []);

    const messagesQueryParams = useMemo(() => {
        if (!teamId || !conversationId) {
            return undefined;
        }

        return buildConversationMessagesQueryParams(teamId, conversationId, {
            page: 1,
            limit: 200
        });
    }, [teamId, conversationId]);

    const messagesResult = messagesQuery(messagesQueryParams ?? fallbackMessagesQueryParams, {
        enabled: Boolean(messagesQueryParams)
    });

    const conversationMessages = useMemo(() => {
        return (messagesResult.data?.data ?? []).map(toUIMessage);
    }, [messagesResult.data]);

    const isMessagesLoading = messagesResult.isLoading;
    const messagesError = messagesResult.error
        ? 'Failed to load conversation messages.'
        : null;

    const loadConversationMessages = useCallback(async (targetConversationId: string) => {
        if (!teamId) {
            return;
        }

        await invalidateConversationMessagesQuery(buildConversationMessagesQueryParams(teamId, targetConversationId, {
            page: 1,
            limit: 200
        }));
    }, [teamId]);

    return {
        conversationMessages,
        messagesQueryParams,
        messagesResult,
        isMessagesLoading,
        messagesError,
        loadConversationMessages
    };
};

export default useAIConversationMessages;

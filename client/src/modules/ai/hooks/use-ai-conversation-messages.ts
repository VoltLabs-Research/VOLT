import { buildConversationMessagesQueryParams, invalidateConversationMessagesQuery, messagesQuery } from '@/modules/ai/hooks/queries';
import { useCallback, useMemo } from 'react';
import type { AIConversationMessage, AIMessageRole } from '@/modules/ai/api/entities/ai-conversation';
import type { UIMessage } from 'ai';

const toUIMessageRole = (role: AIMessageRole): UIMessage['role'] => {
    if (role === 'assistant') {
        return 'assistant';
    }

    return 'user';
};

const toUIMessage = (message: AIConversationMessage): UIMessage => {
    const parts = message.parts;

    if (parts.length > 0) {
        return {
            id: message._id,
            role: toUIMessageRole(message.role),
            parts
        };
    }

    const fallbackText = message.content.trim();
    let fallbackParts: UIMessage['parts'] = [];

    if (fallbackText) {
        fallbackParts = [{ type: 'text', text: fallbackText }];
    }

    return {
        id: message._id,
        role: toUIMessageRole(message.role),
        parts: fallbackParts
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
    let messagesError: string | null = null;
    if (messagesResult.error) {
        messagesError = 'Failed to load conversation messages.';
    }

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

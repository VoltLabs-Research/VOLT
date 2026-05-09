import { invalidateConversationsQueries, invalidateConversationMessagesQuery, resolveConversationStreamTransport } from '@/modules/ai/hooks/queries';
import { useChat } from '@ai-sdk/react';
import { isToolUIPart, lastAssistantMessageIsCompleteWithApprovalResponses, lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AIModelSelection } from '@/modules/ai/api/service';
import type { AIConversationMessage } from '@/modules/ai/api/entities/ai-conversation';
import type { ConversationMessagesQueryParams } from '@/modules/ai/hooks/queries';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { UseQueryResult } from '@tanstack/react-query';
import type { UIMessage } from 'ai';
import type { RefObject } from 'react';

interface ChatMessagesPayload {
    messages: UIMessage[];
}

const createDeferredTransport = () => ({
    sendMessages: async () => {
        throw new Error('teamId and conversationId are required to send a message');
    },
    reconnectToStream: async () => {
        throw new Error('teamId and conversationId are required to reconnect the stream');
    }
});

const lastAssistantMessageHasProviderExecutedApprovalResponses = ({ messages }: ChatMessagesPayload): boolean => {
    const message = messages[messages.length - 1];
    if (!message || message.role !== 'assistant') {
        return false;
    }

    const lastStepStartIndex = message.parts.reduce((lastIndex, part, index) => {
        if (part.type === 'step-start') {
            return index;
        }

        return lastIndex;
    }, -1);

    const lastStepToolInvocations = message.parts
        .slice(lastStepStartIndex + 1)
        .filter(isToolUIPart);

    const hasApprovalResponse = lastStepToolInvocations.some((part) => (
        part.state === 'approval-responded'
    ));

    return (
        hasApprovalResponse
        && lastStepToolInvocations.every((part) => (
            part.state === 'output-available'
            || part.state === 'output-error'
            || part.state === 'approval-responded'
        ))
    );
};

interface UseAIChatStreamOptions {
    teamId: string | null;
    conversationId?: string;
    canSendMessage: boolean;
    selectedModelRef: RefObject<AIModelSelection>;
    conversationMessages: UIMessage[];
    messagesQueryParams?: ConversationMessagesQueryParams;
    messagesResult: UseQueryResult<PaginatedResponse<AIConversationMessage>>;
    skipNextMessageLoadRef: RefObject<boolean>;
}

const useAIChatStream = ({
    teamId,
    conversationId,
    canSendMessage,
    selectedModelRef,
    conversationMessages,
    messagesQueryParams,
    messagesResult,
    skipNextMessageLoadRef
}: UseAIChatStreamOptions) => {
    const [sendMessageError, setSendMessageError] = useState<string | null>(null);
    const isMountedRef = useRef(true);

    const chatTransport = useMemo(() => {
        if (!teamId || !conversationId) {
            return createDeferredTransport();
        }

        const getModelSelection = () => selectedModelRef.current ?? {};

        return resolveConversationStreamTransport({
            teamId,
            conversationId,
            getModelSelection
        });
    }, [conversationId, selectedModelRef, teamId]);

    let chatId = `ai-draft:${teamId || 'none'}`;
    if (conversationId) {
        chatId = `ai-conversation:${conversationId}`;
    }

    const {
        messages: streamMessages,
        status: streamStatus,
        error: streamError,
        sendMessage,
        setMessages,
        addToolApprovalResponse,
        stop
    } = useChat({
        id: chatId,
        transport: chatTransport,
        experimental_throttle: 50,
        sendAutomaticallyWhen: ({ messages }) => (
            lastAssistantMessageIsCompleteWithToolCalls({ messages })
            || lastAssistantMessageIsCompleteWithApprovalResponses({ messages })
            || lastAssistantMessageHasProviderExecutedApprovalResponses({ messages })
        ),
        onFinish: () => {
            if (!isMountedRef.current) return;

            // Small delay to let streamStatus settle to 'ready' so that
            // the setMessages sync effect does not skip the update due
            // to the isSendingMessage guard.
            setTimeout(() => {
                if (!isMountedRef.current) return;

                invalidateConversationsQueries().catch(console.warn);

                if (messagesQueryParams) {
                    invalidateConversationMessagesQuery(messagesQueryParams).catch(console.warn);
                }
            }, 100);
        }
    });

    const isSendingMessage = streamStatus === 'submitted' || streamStatus === 'streaming';

    // Sync server-loaded messages into the stream state
    useEffect(() => {
        if (messagesResult.isSuccess && !skipNextMessageLoadRef.current) {
            setMessages((currentMessages) => {
                const lastMessage = currentMessages[currentMessages.length - 1];
                if (lastMessage?.role === 'assistant') {
                    const hasPendingApproval = lastMessage.parts.some((part) => (
                        isToolUIPart(part) && part.state === 'approval-requested'
                    ));

                    if (hasPendingApproval) {
                        return currentMessages;
                    }
                }

                if (currentMessages.length === 0) {
                    return conversationMessages;
                }

                if (conversationMessages.length === 0) {
                    return currentMessages;
                }

                if (conversationMessages.length < currentMessages.length) {
                    return currentMessages;
                }

                if (isSendingMessage && conversationMessages.length === currentMessages.length) {
                    return currentMessages;
                }

                return conversationMessages;
            });
        }
    }, [conversationMessages, isSendingMessage, messagesResult.isSuccess, setMessages]);

    // Reset messages when conversation changes
    useEffect(() => {
        if (!conversationId) {
            setMessages([]);
            return;
        }

        if (skipNextMessageLoadRef.current) {
            skipNextMessageLoadRef.current = false;
        }
    }, [conversationId, setMessages]);

    // Sync stream errors to local state
    useEffect(() => {
        if (streamError) {
            setSendMessageError(streamError.message);
            return;
        }

        setSendMessageError(null);
    }, [streamError]);

    // Cleanup on unmount
    useEffect(() => {
        isMountedRef.current = true;

        return () => {
            isMountedRef.current = false;
            stop();
        };
    }, [stop]);

    const handleSendMessage = useCallback(async (text: string) => {
        const normalizedText = text.trim();
        if (!normalizedText || !canSendMessage || isSendingMessage || !conversationId) return;

        setSendMessageError(null);

        try {
            await sendMessage({ text: normalizedText });
        } catch (error) {
            let streamFailure = new Error('Failed to send message');
            if (error instanceof Error) {
                streamFailure = error;
            }

            setSendMessageError(streamFailure.message);
            throw streamFailure;
        }
    }, [canSendMessage, conversationId, isSendingMessage, sendMessage]);

    return {
        messages: streamMessages,
        isSendingMessage,
        sendMessageError,
        handleSendMessage,
        addToolApprovalResponse
    };
};

export default useAIChatStream;

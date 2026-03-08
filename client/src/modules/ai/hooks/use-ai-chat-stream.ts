import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isToolUIPart, lastAssistantMessageIsCompleteWithApprovalResponses, lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import { invalidateConversationsQueries, invalidateConversationMessagesQuery, resolveConversationStreamTransport } from '@/modules/ai/hooks/queries';
import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import type { ConversationMessagesQueryParams } from '@/modules/ai/hooks/queries';
import type { AIProvider } from '@/modules/ai/api/entities/ai-constants';
import type { UseQueryResult } from '@tanstack/react-query';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { AIConversationMessage } from '@/modules/ai/api/entities/ai-conversation';

const lastAssistantMessageHasProviderExecutedApprovalResponses = ({ messages }: { messages: UIMessage[]; }): boolean => {
    const message = messages[messages.length - 1];
    if (!message || message.role !== 'assistant') {
        return false;
    }

    const lastStepStartIndex = message.parts.reduce((lastIndex, part, index) => (
        part.type === 'step-start' ? index : lastIndex
    ), -1);

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
    selectedModelRef: React.RefObject<{ provider?: AIProvider; model?: string }>;
    conversationMessages: UIMessage[];
    messagesQueryParams?: ConversationMessagesQueryParams;
    messagesResult: UseQueryResult<PaginatedResponse<AIConversationMessage>>;
    skipNextMessageLoadRef: React.RefObject<boolean>;
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
        return resolveConversationStreamTransport({
            teamId: teamId ?? undefined,
            conversationId,
            getModelSelection: () => selectedModelRef.current
        });
    }, [conversationId, teamId]);

    const {
        messages: streamMessages,
        status: streamStatus,
        error: streamError,
        sendMessage,
        setMessages,
        addToolApprovalResponse,
        stop
    } = useChat({
        id: conversationId ? `ai-conversation:${conversationId}` : `ai-draft:${teamId || 'none'}`,
        transport: chatTransport,
        sendAutomaticallyWhen: ({ messages }) => (
            lastAssistantMessageIsCompleteWithToolCalls({ messages })
            || lastAssistantMessageIsCompleteWithApprovalResponses({ messages })
            || lastAssistantMessageHasProviderExecutedApprovalResponses({ messages })
        ),
        onFinish: () => {
            if (!isMountedRef.current) return;

            invalidateConversationsQueries().catch(console.warn);

            if (messagesQueryParams) {
                invalidateConversationMessagesQuery(messagesQueryParams).catch(console.warn);
            }
        }
    });

    const isSendingMessage = streamStatus === 'submitted' || streamStatus === 'streaming';

    // Sync server-loaded messages into the stream state
    useEffect(() => {
        if (messagesResult.isSuccess && !skipNextMessageLoadRef.current) {
            setMessages((currentMessages) => {
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
            const streamFailure = error instanceof Error ? error : new Error('Failed to send message');
            setSendMessageError(streamFailure.message);
            throw streamFailure;
        }
    }, [canSendMessage, conversationId, isSendingMessage, sendMessage]);

    const handleToolApprovalResponse = useCallback((
        approvalResponse: { id: string; approved: boolean; reason?: string }
    ) => {
        return addToolApprovalResponse(approvalResponse);
    }, [addToolApprovalResponse]);

    return {
        messages: streamMessages,
        isSendingMessage,
        sendMessageError,
        handleSendMessage,
        addToolApprovalResponse: handleToolApprovalResponse
    };
};

export default useAIChatStream;

import { createConversationStreamTransport } from '@/modules/ai/services/stream-transport';
import { invalidateConversationsQueries, invalidateConversationMessagesQuery } from '@/modules/ai/hooks/queries';
import { useClientToolDispatch } from '@/modules/ai/tools/use-client-tool-dispatch';
import { useChat } from '@ai-sdk/react';
import { isToolUIPart, lastAssistantMessageIsCompleteWithApprovalResponses, lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { AddToolResultFn } from '@/modules/ai/tools/use-client-tool-dispatch';
import type { AIModelSelection } from '@/modules/ai/api/service';
import type { AIConversationMessage } from '@/modules/ai/contracts/messages';
import type { ConversationMessagesQueryParams } from '@/modules/ai/hooks/queries';
import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ChatTransport, UIMessage } from 'ai';
import type { RefObject } from 'react';

const createDeferredTransport = (): ChatTransport<UIMessage> => ({
    sendMessages: async () => {
        throw new Error('teamId and conversationId are required to send a message');
    },
    reconnectToStream: async () => {
        throw new Error('teamId and conversationId are required to reconnect the stream');
    }
});

const lastAssistantMessageHasProviderExecutedApprovalResponses = ({ messages }: { messages: UIMessage[] }): boolean => {
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
    const isMountedRef = useRef(true);
    const hydratedConversationRef = useRef<string | null>(null);

    const chatTransport = useMemo(() => {
        if (!teamId || !conversationId) {
            return createDeferredTransport();
        }

        return createConversationStreamTransport({
            teamId,
            conversationId,
            getModelSelection: () => selectedModelRef.current
        });
    }, [conversationId, selectedModelRef, teamId]);

    let chatId = `ai-draft:${teamId || 'none'}`;
    if (conversationId) {
        chatId = `ai-conversation:${conversationId}`;
    }

    const dispatchClientTool = useClientToolDispatch();
    const addToolResultRef = useRef<AddToolResultFn | null>(null);

    const {
        messages: streamMessages,
        status: streamStatus,
        error: streamError,
        sendMessage,
        setMessages,
        addToolResult,
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
        onToolCall: ({ toolCall }) => {
            const addResult = addToolResultRef.current;
            if (!addResult) return;

            return dispatchClientTool(
                {
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    input: toolCall.input
                },
                addResult
            );
        },
        onFinish: () => {
            if (!isMountedRef.current) return;

            invalidateConversationsQueries().catch(console.warn);

            if (messagesQueryParams) {
                invalidateConversationMessagesQuery(messagesQueryParams).catch(console.warn);
            }
        }
    });

    addToolResultRef.current = addToolResult as AddToolResultFn;

    const isSendingMessage = streamStatus === 'submitted' || streamStatus === 'streaming';

    useEffect(() => {
        const targetConversationId = conversationId ?? null;

        if (hydratedConversationRef.current === targetConversationId) {
            return;
        }

        if (!targetConversationId) {
            hydratedConversationRef.current = null;
            setMessages([]);
            return;
        }

        if (skipNextMessageLoadRef.current) {
            skipNextMessageLoadRef.current = false;
            hydratedConversationRef.current = targetConversationId;
            return;
        }

        if (messagesResult.isSuccess) {
            setMessages(conversationMessages);
            hydratedConversationRef.current = targetConversationId;
        }
    }, [conversationId, conversationMessages, messagesResult.isSuccess, setMessages, skipNextMessageLoadRef]);

    const sendMessageError = streamError?.message ?? null;

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

        await sendMessage({ text: normalizedText });
    }, [canSendMessage, conversationId, isSendingMessage, sendMessage]);

    return {
        messages: streamMessages,
        isSendingMessage,
        sendMessageError,
        handleSendMessage,
        stopStreaming: stop,
        addToolApprovalResponse
    };
};

export default useAIChatStream;

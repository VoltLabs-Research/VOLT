import { useChat } from '@ai-sdk/react';
import { useCallback, useEffect, useMemo } from 'react';
import { chatHub, useChatHub } from '@/modules/ai/store/chat-hub';
import type { AIModelChoice } from '@volt/contracts/modules/ai/domain';
import type { ChatUIMessage } from '@volt/contracts/modules/ai/chat';

const THROTTLE_MS = 50;

export interface ChatSession {
    messages: ChatUIMessage[];
    setMessages: (update: ChatUIMessage[] | ((messages: ChatUIMessage[]) => ChatUIMessage[])) => void;
    connected: boolean;
    joined: boolean;
    failure: string | null;
    isStreaming: boolean;
    // Joined and not answering: the only state in which the socket takes a turn.
    canAsk: boolean;
    error: Error | undefined;
    clearError: () => void;
    send: (text: string, model: AIModelChoice | null) => boolean;
    decide: (approvalIds: string[], approved: boolean) => boolean;
    stop: () => void;
}

export const useChatSession = (conversationId: string): ChatSession => {
    const chat = useMemo(() => chatHub.chatFor(conversationId), [conversationId]);
    const { messages, setMessages, status, error, clearError, sendMessage, stop } = useChat<ChatUIMessage>({
        chat,
        throttle: THROTTLE_MS
    });
    const connected = useChatHub((state) => state.connected);
    const joined = useChatHub((state) => state.joined[conversationId] === true);
    const failure = useChatHub((state) => state.failures[conversationId] ?? null);

    useEffect(() => chatHub.attach(conversationId), [conversationId]);

    const isStreaming = status === 'submitted' || status === 'streaming';
    const canAsk = joined && !isStreaming;

    const send = useCallback((text: string, model: AIModelChoice | null): boolean => {
        const spoken = text.trim();
        if (!canAsk || spoken === '') return false;

        void sendMessage({
            text: spoken,
            metadata: { createdAt: new Date().toISOString() }
        }, { body: model === null ? {} : { model } });

        return true;
    }, [canAsk, sendMessage]);

    const decide = useCallback((approvalIds: string[], approved: boolean): boolean => {
        if (!canAsk || approvalIds.length === 0) return false;

        void sendMessage(undefined, {
            body: {
                approvals: approvalIds.map((approvalId) => ({
                    approvalId,
                    approved
                }))
            }
        });

        return true;
    }, [canAsk, sendMessage]);

    const halt = useCallback(() => {
        chatHub.stop(conversationId);
        void stop();
    }, [conversationId, stop]);

    return {
        messages,
        setMessages,
        connected,
        joined,
        failure,
        isStreaming,
        canAsk,
        error,
        clearError,
        send,
        decide,
        stop: halt
    };
};

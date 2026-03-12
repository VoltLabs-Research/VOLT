import { CHAT_SOCKET_EVENTS } from '../../api/entities/shared/chat-constants';
import {
    addMessageToCache,
    removeChatMessagesFromCache,
    updateMessageInCache,
    useChatMessagesInfiniteQuery,
    useMarkAsReadMutation
} from '../message/queries';
import {
    invalidateChatsQuery,
    resetChatQueries,
    chatsQuery
} from './queries';
import { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { sileo } from 'sileo';
import { notifyApiError, isAccessDeniedError } from '@/shared/errors/notify-api-error';
import useSocket from '@/modules/socket/core/hooks/use-socket';
import type { ChatMessage } from '../../api/entities/message';

const useChatData = () => {
    const socket = useSocket();
    const queryClient = useQueryClient();

    const [currentChatId, setCurrentChatId] = useState<string | null>(null);
    const currentChatIdRef = useRef<string | null>(null);

    const markAsReadMutationResult = useMarkAsReadMutation();

    const chatsResult = chatsQuery(undefined, {
        staleTime: 30_000,
        retry: false
    });

    const chats = chatsResult.data ?? [];
    const chatsRef = useRef(chats);

    useEffect(() => {
        chatsRef.current = chats;
    }, [chats]);

    useEffect(() => {
        if (chatsResult.error) {
            const error = chatsResult.error;
            if (isAccessDeniedError(error)) return;
            sileo.error({ title: 'Failed to load chats' });
        }
    }, [chatsResult.error]);

    const messagesQuery = useChatMessagesInfiniteQuery(
        { chatId: currentChatId! },
        {
            enabled: !!currentChatId
        }
    );

    const messages = useMemo(
        () => (messagesQuery.data?.pages.flatMap((p) => p.data) ?? []).sort((left, right) => {
            return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
        }),
        [messagesQuery.data]
    );

    const hasMore = messagesQuery.hasNextPage ?? false;

    const fetchChats = useCallback((): void => {
        invalidateChatsQuery(queryClient).catch(() => undefined);
    }, [queryClient]);

    const loadMoreMessages = useCallback((_chatId?: string, _currentPage?: number): void => {
        if (!messagesQuery.isFetchingNextPage && messagesQuery.hasNextPage) {
            messagesQuery.fetchNextPage().catch(() => undefined);
        }
    }, [messagesQuery]);

    const addMessage = useCallback((message: ChatMessage) => {
        addMessageToCache(queryClient, currentChatIdRef.current, message);
    }, [queryClient]);

    const updateMessage = useCallback((_id: string, updates: Partial<ChatMessage>) => {
        updateMessageInCache(queryClient, currentChatIdRef.current, _id, updates);
    }, [queryClient]);

    const resetState = useCallback(() => {
        if (currentChatIdRef.current) {
            socket.emit(CHAT_SOCKET_EVENTS.LEAVE_CHAT, currentChatIdRef.current);
        }

        currentChatIdRef.current = null;
        setCurrentChatId(null);
        resetChatQueries(queryClient);
    }, [queryClient, socket]);

    const selectChat = useCallback(async (chatId: string) => {
        if (currentChatIdRef.current === chatId) return;

        if (currentChatIdRef.current) {
            socket.emit(CHAT_SOCKET_EVENTS.LEAVE_CHAT, currentChatIdRef.current).catch(() => undefined);
            removeChatMessagesFromCache(queryClient, currentChatIdRef.current);
        }

        currentChatIdRef.current = chatId;
        setCurrentChatId(chatId);

        await socket.emit(CHAT_SOCKET_EVENTS.JOIN_CHAT, chatId);

        markAsReadMutationResult.mutateAsync({ chatId }).catch((error: unknown) => {
            if (isAccessDeniedError(error)) {
                notifyApiError(error, { fallbackTitle: 'You do not have permission to perform this action.' });
            }
        });

        const chat = chatsRef.current.find((c) => c._id === chatId);
        if (chat) {
            const userIds = chat.participants.map((p) => p._id);
            socket.emit(CHAT_SOCKET_EVENTS.GET_USERS_PRESENCE, { userIds }).catch(() => undefined);
        }
    }, [socket, queryClient, markAsReadMutationResult]);

    return {
        chats,
        messages,
        currentChatId,
        hasMore,
        page: messagesQuery.data?.pages.length ?? 1,
        fetchChats,
        selectChat,
        loadMoreMessages,
        resetState,
        addMessage,
        updateMessage,
        isChatsLoading: chatsResult.isLoading,
        isMessagesLoading: messagesQuery.isLoading || messagesQuery.isFetchingNextPage,
        chatsError: chatsResult.error,
        messagesError: messagesQuery.error
    };
};

export default useChatData;

import { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import useSocket from '@/modules/socket/hooks/use-socket';
import { CHAT_SOCKET_EVENTS } from '../api/entities/chat-constants';
import {
    addMessageToCache,
    removeChatMessagesFromCache,
    updateMessageInCache,
    useChatMessagesInfiniteQuery,
    useMarkAsReadMutation
} from './message/queries';
import {
    invalidateChatsQuery,
    resetChatQueries,
    chatsQuery
} from './chat/queries';
import type { ChatMessage } from '../api/entities/chat-message';
import ApiError from '@/shared/errors/ApiError';
import { sileo } from 'sileo';

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
            if (ApiError.isRBACError(error)) return;
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

    const fetchChats = useCallback(() => {
        void invalidateChatsQuery(queryClient);
    }, [queryClient]);

    const loadMoreMessages = useCallback((_chatId?: string, _currentPage?: number) => {
        if (!messagesQuery.isFetchingNextPage && messagesQuery.hasNextPage) {
            messagesQuery.fetchNextPage();
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
            void socket.emit(CHAT_SOCKET_EVENTS.LEAVE_CHAT, currentChatIdRef.current).catch(() => undefined);
            removeChatMessagesFromCache(queryClient, currentChatIdRef.current);
        }

        currentChatIdRef.current = chatId;
        setCurrentChatId(chatId);

        await socket.emit(CHAT_SOCKET_EVENTS.JOIN_CHAT, chatId);

        markAsReadMutationResult.mutateAsync({ chatId }).catch((error: unknown) => {
            if (ApiError.isRBACError(error)) {
                const friendlyMessage = error instanceof ApiError
                    ? error.getFriendlyMessage()
                    : 'You do not have permission to perform this action.';
                sileo.error({ title: friendlyMessage });
            }
        });

        const chat = chatsRef.current.find((c) => c._id === chatId);
        if (chat) {
            const userIds = chat.participants.map((p) => p._id);
            void socket.emit(CHAT_SOCKET_EVENTS.GET_USERS_PRESENCE, { userIds }).catch(() => undefined);
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
        isMessagesLoading: messagesQuery.isLoading || messagesQuery.isFetchingNextPage
    };
};

export default useChatData;

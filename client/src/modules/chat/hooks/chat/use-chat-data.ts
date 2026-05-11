import { SOCKET_CHAT_EVENTS } from '@/modules/socket/events/chat';
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
import { ErrorSurface, isAccessDeniedError, reportError } from '@/shared/errors/core';
import { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { sileo } from 'sileo';
import { emitOrSwallow, emitWithReport } from '@/modules/socket/services/socket-emit-helpers';
import type { ChatMessage } from '../../api/entities/message';

const MAX_CACHED_CHAT_ROOMS = 4;

interface SocketAck<T = unknown> {
    ok: boolean;
    data?: T;
    error?: string;
}

const expectSocketAck = <T>(ack: SocketAck<T> | undefined, fallbackMessage: string): T | undefined => {
    if (!ack?.ok) {
        throw new Error(ack?.error || fallbackMessage);
    }

    return ack.data;
};

const useChatData = () => {
    const queryClient = useQueryClient();

    const [currentChatId, setCurrentChatId] = useState<string | null>(null);
    const currentChatIdRef = useRef<string | null>(null);
    const cachedChatIdsRef = useRef<string[]>([]);
    const selectionVersionRef = useRef(0);
    const desiredChatIdRef = useRef<string | null>(null);
    const lastPresenceRequestKeyRef = useRef<string | null>(null);

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

    const loadMoreMessages = useCallback((): void => {
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

    const retainChatMessageCache = useCallback((chatId: string) => {
        cachedChatIdsRef.current = [
            ...cachedChatIdsRef.current.filter((cachedChatId) => cachedChatId !== chatId),
            chatId
        ];

        while (cachedChatIdsRef.current.length > MAX_CACHED_CHAT_ROOMS) {
            const evictedChatId = cachedChatIdsRef.current.shift();

            if (evictedChatId) {
                removeChatMessagesFromCache(queryClient, evictedChatId);
            }
        }
    }, [queryClient]);

    const requestChatPresence = useCallback((chatId: string, userIds: string[]) => {
        const uniqueUserIds = Array.from(new Set(userIds));
        const requestKey = `${chatId}:${uniqueUserIds.join(',')}`;

        if (uniqueUserIds.length === 0 || lastPresenceRequestKeyRef.current === requestKey) {
            return;
        }

        lastPresenceRequestKeyRef.current = requestKey;

        emitWithReport<SocketAck<Record<string, string>>>(SOCKET_CHAT_EVENTS.GET_USERS_PRESENCE, {
            userIds: uniqueUserIds
        })
            .then((presenceAck) => {
                expectSocketAck(presenceAck, 'Failed to load chat presence.');
            })
            .catch((error: unknown) => {
                if (lastPresenceRequestKeyRef.current === requestKey) {
                    lastPresenceRequestKeyRef.current = null;
                }

                reportError(error, {
                    surface: ErrorSurface.Toast,
                    fallbackTitle: 'Failed to load chat presence.'
                });
            });
    }, []);

    useEffect(() => {
        if (!currentChatId) {
            lastPresenceRequestKeyRef.current = null;
            return;
        }

        const currentChat = chats.find((chat) => chat._id === currentChatId);
        if (!currentChat) {
            return;
        }

        requestChatPresence(currentChatId, currentChat.participants.map((participant) => participant._id));
    }, [chats, currentChatId, requestChatPresence]);

    const resetState = useCallback(() => {
        selectionVersionRef.current += 1;
        desiredChatIdRef.current = null;
        lastPresenceRequestKeyRef.current = null;

        if (currentChatIdRef.current) {
            emitOrSwallow(SOCKET_CHAT_EVENTS.LEAVE_CHAT, currentChatIdRef.current);
        }

        cachedChatIdsRef.current = [];
        currentChatIdRef.current = null;
        setCurrentChatId(null);
        resetChatQueries(queryClient);
    }, [queryClient]);

    const selectChat = useCallback(async (chatId: string) => {
        if (currentChatIdRef.current === chatId) return;

        const selectionVersion = ++selectionVersionRef.current;
        desiredChatIdRef.current = chatId;
        const previousChatId = currentChatIdRef.current;

        if (previousChatId) {
            emitOrSwallow(SOCKET_CHAT_EVENTS.LEAVE_CHAT, previousChatId);
        }

        currentChatIdRef.current = null;
        setCurrentChatId(null);

        const joinAck = await emitWithReport<SocketAck>(SOCKET_CHAT_EVENTS.JOIN_CHAT, chatId);
        expectSocketAck(joinAck, `Unable to join chat "${chatId}".`);

        if (selectionVersion !== selectionVersionRef.current) {
            if (desiredChatIdRef.current !== chatId) {
                emitOrSwallow(SOCKET_CHAT_EVENTS.LEAVE_CHAT, chatId);
            }
            return;
        }

        retainChatMessageCache(chatId);
        currentChatIdRef.current = chatId;
        setCurrentChatId(chatId);

        markAsReadMutationResult.mutateAsync({ chatId }).catch((error: unknown) => {
            if (isAccessDeniedError(error)) {
                reportError(error, {
                    surface: ErrorSurface.Toast,
                    fallbackTitle: 'You do not have permission to perform this action.'
                });
            }
        });

        const chat = chatsRef.current.find((currentChat) => currentChat._id === chatId);
        if (!chat) {
            return;
        }

        requestChatPresence(chatId, chat.participants.map((participant) => participant._id));
    }, [markAsReadMutationResult, requestChatPresence, retainChatMessageCache]);

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

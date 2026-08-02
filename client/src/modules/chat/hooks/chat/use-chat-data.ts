import { SOCKET_CHAT_EVENTS } from '@/modules/socket/events/chat';
import {
    removeChatMessagesFromCache,
    useChatMessagesInfiniteQuery,
    useMarkAsReadMutation
} from '../message/queries';
import { resetChatQueries, chatsQuery } from './queries';
import { ErrorSurface, isAccessDeniedError, reportError } from '@/shared/errors/core';
import { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import { sileo } from 'sileo';
import { emitOrSwallow, emitWithReport } from '@/modules/socket/services/socket-emit-helpers';
import type { SocketAck } from '@/modules/socket/contracts/socket-service';

const MAX_CACHED_CHAT_ROOMS = 4;

const assertSocketAck = (ack: SocketAck | undefined, fallbackMessage: string): void => {
    if (!ack?.ok) {
        throw new Error(ack?.error || fallbackMessage);
    }
};

const useChatData = () => {
    const [currentChatId, setCurrentChatId] = useState<string | null>(null);
    const currentChatIdRef = useRef<string | null>(null);
    const cachedChatIdsRef = useRef<string[]>([]);
    const selectionVersionRef = useRef(0);
    const desiredChatIdRef = useRef<string | null>(null);
    const lastPresenceRequestKeyRef = useRef<string | null>(null);

    const { mutateAsync: markChatAsRead } = useMarkAsReadMutation();

    const chatsResult = chatsQuery(undefined, {
        staleTime: 30_000,
        retry: false
    });

    const chats = chatsResult.data ?? [];

    useEffect(() => {
        if (chatsResult.error && !isAccessDeniedError(chatsResult.error)) {
            sileo.error({ title: 'Failed to load chats' });
        }
    }, [chatsResult.error]);

    const messagesQuery = useChatMessagesInfiniteQuery(
        { chatId: currentChatId! },
        { enabled: !!currentChatId }
    );

    const messages = useMemo(
        () => messagesQuery.data?.pages.flatMap((p) => p.data) ?? [],
        [messagesQuery.data]
    );

    const loadMoreMessages = (): void => {
        if (!messagesQuery.isFetchingNextPage && messagesQuery.hasNextPage) {
            messagesQuery.fetchNextPage().catch(() => undefined);
        }
    };

    const retainChatMessageCache = useCallback((chatId: string) => {
        cachedChatIdsRef.current = [
            ...cachedChatIdsRef.current.filter((cachedChatId) => cachedChatId !== chatId),
            chatId
        ];

        while (cachedChatIdsRef.current.length > MAX_CACHED_CHAT_ROOMS) {
            const evictedChatId = cachedChatIdsRef.current.shift();

            if (evictedChatId) {
                removeChatMessagesFromCache(evictedChatId);
            }
        }
    }, []);

    useEffect(() => {
        if (!currentChatId) {
            lastPresenceRequestKeyRef.current = null;
            return;
        }

        const currentChat = chatsResult.data?.find((chat) => chat._id === currentChatId);
        if (!currentChat) {
            return;
        }

        const userIds = currentChat.participants.map((participant) => participant._id);
        const requestKey = `${currentChatId}:${userIds.join(',')}`;

        if (lastPresenceRequestKeyRef.current === requestKey) {
            return;
        }

        lastPresenceRequestKeyRef.current = requestKey;

        emitWithReport<SocketAck>(SOCKET_CHAT_EVENTS.GET_USERS_PRESENCE, { userIds })
            .then((presenceAck) => {
                assertSocketAck(presenceAck, 'Failed to load chat presence.');
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
    }, [chatsResult.data, currentChatId]);

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
        resetChatQueries();
    }, []);

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
        assertSocketAck(joinAck, `Unable to join chat "${chatId}".`);

        if (selectionVersion !== selectionVersionRef.current) {
            if (desiredChatIdRef.current !== chatId) {
                emitOrSwallow(SOCKET_CHAT_EVENTS.LEAVE_CHAT, chatId);
            }
            return;
        }

        retainChatMessageCache(chatId);
        currentChatIdRef.current = chatId;
        setCurrentChatId(chatId);

        markChatAsRead({ chatId }).catch((error: unknown) => {
            if (isAccessDeniedError(error)) {
                reportError(error, {
                    surface: ErrorSurface.Toast,
                    fallbackTitle: 'You do not have permission to perform this action.'
                });
            }
        });
    }, [markChatAsRead, retainChatMessageCache]);

    return {
        chats,
        messages,
        currentChatId,
        hasMore: messagesQuery.hasNextPage,
        selectChat,
        loadMoreMessages,
        resetState,
        isChatsLoading: chatsResult.isLoading,
        isMessagesLoading: messagesQuery.isLoading || messagesQuery.isFetchingNextPage,
        chatsError: chatsResult.error
    };
};

export default useChatData;

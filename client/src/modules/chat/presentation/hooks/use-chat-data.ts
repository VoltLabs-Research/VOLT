import { useCallback, useRef, useEffect, useMemo } from 'react';
import { container } from 'tsyringe';
import useSocket from '@/modules/socket/presentation/hooks/use-socket';
import { useChatStore, useChatMessageStore } from '../stores';
import { CHAT_TOKENS } from '@/modules/chat/infrastructure/di/tokens';
import { CHAT_SOCKET_EVENTS } from '@/modules/chat/domain/constants';
import type IChatRepository from '@/modules/chat/domain/port/IChatRepository';
import type IChatMessageRepository from '@/modules/chat/domain/port/IChatMessageRepository';
import { sileo } from 'sileo';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import ApiError from '@/shared/errors/ApiError';

const useChatData = () => {
    const socket = useSocket();
    const { accessDenied, accessDeniedMessage, checkRBACError } = useAccessDenied();

    // Resolve DI inside hook to ensure container is ready
    const chatRepository = useMemo(
        () => container.resolve<IChatRepository>(CHAT_TOKENS.ChatRepository),
        []
    );
    const chatMessageRepository = useMemo(
        () => container.resolve<IChatMessageRepository>(CHAT_TOKENS.ChatMessageRepository),
        []
    );

    // Chat store
    const chats = useChatStore((state) => state.chats);
    const setChats = useChatStore((state) => state.setChats);
    const setChatsLoading = useChatStore((state) => state.setLoading);
    const resetChats = useChatStore((state) => state.reset);

    // Message store
    const setMessages = useChatMessageStore((state) => state.setMessages);
    const appendMessages = useChatMessageStore((state) => state.appendMessages);
    const setMessagesLoading = useChatMessageStore((state) => state.setLoading);
    const setHasMore = useChatMessageStore((state) => state.setHasMore);
    const setPage = useChatMessageStore((state) => state.setPage);
    const resetMessages = useChatMessageStore((state) => state.reset);

    // Refs
    const currentChatIdRef = useRef<string | null>(null);
    const hasFetchedChatsRef = useRef(false);
    const isFetchingRef = useRef(false);
    const chatsRef = useRef(chats);
    const chatsRequestGenerationRef = useRef(0);
    const messagesRequestGenerationRef = useRef(0);

    useEffect(() => {
        chatsRef.current = chats;
    }, [chats]);

    const fetchChats = useCallback(async () => {
        if (hasFetchedChatsRef.current || isFetchingRef.current) return;

        const requestGeneration = chatsRequestGenerationRef.current;

        isFetchingRef.current = true;
        hasFetchedChatsRef.current = true;
        setChatsLoading(true);
        try {
            const data = await chatRepository.getAll();
            if (requestGeneration !== chatsRequestGenerationRef.current) return;
            setChats(data);
        } catch(error) {
            if (requestGeneration !== chatsRequestGenerationRef.current) return;
            if(checkRBACError(error)) return;
            sileo.error({ title: 'Failed to load chats' });
            hasFetchedChatsRef.current = false;
        } finally {
            if (requestGeneration !== chatsRequestGenerationRef.current) return;
            isFetchingRef.current = false;
            setChatsLoading(false);
        }
    }, [chatRepository, checkRBACError, setChats, setChatsLoading]);

    const fetchMessages = useCallback(async (chatId: string, page: number = 1) => {
        const requestGeneration = messagesRequestGenerationRef.current;

        setMessagesLoading(true);
        try {
            const response = await chatMessageRepository.getMessages(chatId, { page, limit: 50 });

            if (requestGeneration !== messagesRequestGenerationRef.current) return;

            if (page === 1) {
                setMessages(response.data);
            } else {
                appendMessages(response.data);
            }

            setHasMore(response.pagination.hasMore);
            setPage(page);
        } catch(error) {
            if (requestGeneration !== messagesRequestGenerationRef.current) return;
            if(checkRBACError(error)) return;
            sileo.error({ title: 'Failed to load messages' });
        } finally {
            if (requestGeneration !== messagesRequestGenerationRef.current) return;
            setMessagesLoading(false);
        }
    }, [appendMessages, chatMessageRepository, checkRBACError, setHasMore, setMessages, setMessagesLoading, setPage]);

    const resetState = useCallback(() => {
        chatsRequestGenerationRef.current += 1;
        messagesRequestGenerationRef.current += 1;

        if (currentChatIdRef.current) {
            socket.emit(CHAT_SOCKET_EVENTS.LEAVE_CHAT, currentChatIdRef.current);
        }

        currentChatIdRef.current = null;
        hasFetchedChatsRef.current = false;
        isFetchingRef.current = false;

        resetChats();
        resetMessages();
    }, [resetChats, resetMessages, socket]);

    const selectChat = useCallback(async (chatId: string) => {
        if (currentChatIdRef.current === chatId) return;

        if (currentChatIdRef.current) {
            socket.emit(CHAT_SOCKET_EVENTS.LEAVE_CHAT, currentChatIdRef.current);
        }

        messagesRequestGenerationRef.current += 1;
        currentChatIdRef.current = chatId;
        resetMessages();

        socket.emit(CHAT_SOCKET_EVENTS.JOIN_CHAT, chatId);
        await fetchMessages(chatId);

        if (currentChatIdRef.current !== chatId) {
            return;
        }

        chatMessageRepository.markAsRead(chatId).catch((error: unknown) => {
            if(ApiError.isRBACError(error)){
                const msg = error instanceof ApiError ? error.getFriendlyMessage() : 'You do not have permission to perform this action.';
                sileo.error({ title: msg });
            }
        });

        const chat = chatsRef.current.find((c) => c._id === chatId);
        if (chat) {
            const userIds = chat.participants.map((p) => p._id);
            socket.emit(CHAT_SOCKET_EVENTS.GET_USERS_PRESENCE, { userIds });
        }
    }, [socket, fetchMessages, resetMessages, chatMessageRepository]);

    const loadMoreMessages = useCallback(async (chatId: string, currentPage: number) => {
        await fetchMessages(chatId, currentPage + 1);
    }, [fetchMessages]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            resetState();
        };
    }, [resetState]);

    return {
        fetchChats,
        fetchMessages,
        selectChat,
        loadMoreMessages,
        resetState,
        accessDenied,
        accessDeniedMessage
    };
};

export default useChatData;

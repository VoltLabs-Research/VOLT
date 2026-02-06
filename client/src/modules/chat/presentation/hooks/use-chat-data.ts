import { useCallback, useRef, useEffect, useMemo } from 'react';
import { container } from 'tsyringe';
import useSocket from '@/modules/socket/presentation/hooks/use-socket';
import { useChatStore, useChatMessageStore } from '../stores';
import { CHAT_TOKENS } from '@/modules/chat/infrastructure/di/tokens';
import { CHAT_SOCKET_EVENTS } from '@/modules/chat/domain/constants';
import type IChatRepository from '@/modules/chat/domain/ports/IChatRepository';
import type IChatMessageRepository from '@/modules/chat/domain/ports/IChatMessageRepository';

const useChatData = () => {
    const socket = useSocket();

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

    useEffect(() => {
        chatsRef.current = chats;
    }, [chats]);

    const fetchChats = useCallback(async () => {
        if (hasFetchedChatsRef.current || isFetchingRef.current) return;

        isFetchingRef.current = true;
        hasFetchedChatsRef.current = true;
        setChatsLoading(true);
        try {
            const data = await chatRepository.getAll();
            setChats(data);
        } catch (error) {
            console.error('Failed to fetch chats:', error);
            hasFetchedChatsRef.current = false;
        } finally {
            isFetchingRef.current = false;
            setChatsLoading(false);
        }
    }, [chatRepository, setChats, setChatsLoading]);

    const fetchMessages = useCallback(async (chatId: string, page: number = 1) => {
        setMessagesLoading(true);
        try {
            const response = await chatMessageRepository.getMessages(chatId, { page, limit: 50 });
            
            if (page === 1) {
                setMessages(response.data.reverse());
            } else {
                appendMessages(response.data.reverse());
            }
            
            setHasMore(response.pagination.hasMore);
            setPage(page);
        } catch (error) {
            console.error('Failed to fetch messages:', error);
        } finally {
            setMessagesLoading(false);
        }
    }, [chatMessageRepository, setMessages, appendMessages, setMessagesLoading, setHasMore, setPage]);

    const selectChat = useCallback(async (chatId: string) => {
        if (currentChatIdRef.current === chatId) return;

        if (currentChatIdRef.current) {
            socket.emit(CHAT_SOCKET_EVENTS.LEAVE_CHAT, currentChatIdRef.current);
        }

        currentChatIdRef.current = chatId;
        resetMessages();

        socket.emit(CHAT_SOCKET_EVENTS.JOIN_CHAT, chatId);
        await fetchMessages(chatId);
        chatMessageRepository.markAsRead(chatId).catch(console.error);

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
            if (currentChatIdRef.current) {
                socket.emit(CHAT_SOCKET_EVENTS.LEAVE_CHAT, currentChatIdRef.current);
            }
        };
    }, [socket]);

    return {
        fetchChats,
        fetchMessages,
        selectChat,
        loadMoreMessages
    };
};

export default useChatData;

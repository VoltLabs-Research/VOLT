import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getChatUseCases } from '../../application/registry';
import { useChatStore } from '../stores';
import { chatQueryKeys } from './use-chat-queries';
import type { Message, TypingUser } from '../../domain/entities';

const SOCKET_EVENTS = {
    JOINED_CHAT: 'joined_chat',
    LEFT_CHAT: 'left_chat',
    NEW_MESSAGE: 'new_message',
    USER_TYPING: 'user_typing',
    MESSAGES_READ: 'messages_read',
    MESSAGE_EDITED: 'message_edited',
    MESSAGE_DELETED: 'message_deleted',
    REACTION_UPDATED: 'reaction_updated',
    USER_PRESENCE_UPDATE: 'user_presence_update',
    USERS_PRESENCE_INFO: 'users_presence_info',
    ERROR: 'error'
} as const;

export const useChatSocket = (currentChatId: string | null) => {
    const queryClient = useQueryClient();
    const setConnected = useChatStore(s => s.setConnected);
    const setTypingUsers = useChatStore(s => s.setTypingUsers);
    const setUserPresence = useChatStore(s => s.setUserPresence);
    const setUsersPresence = useChatStore(s => s.setUsersPresence);
    
    // We need a ref for currentChatId to use in callbacks without re-subscribing
    const chatIdRef = useRef(currentChatId);
    useEffect(() => { chatIdRef.current = currentChatId; }, [currentChatId]);

    useEffect(() => {
        const { chatSocketUseCase } = getChatUseCases();
        
        const handleNewMessage = ({ message, chatId }: { message: Message; chatId: string }) => {
            if (chatId !== chatIdRef.current) return;
            
            queryClient.setQueryData(chatQueryKeys.messages(chatId), (oldData: any) => {
                if (!oldData) return oldData;
                const newPages = [...oldData.pages];
                // Append to the last page or first page? Usually first page is most recent if reversed, 
                // but standard infinite query appends to end. 
                // Assuming chat messages are fetched newest-first or oldest-first? 
                // Usually chats are oldest-first (page 1) to newest.
                // If we append, we append to the last page.
                if (newPages.length > 0) {
                    const lastPage = newPages[newPages.length - 1];
                    // Create a new array for the page to ensure immutability
                    const updatedLastPage = [...lastPage, message];
                    newPages[newPages.length - 1] = updatedLastPage;
                }
                return { ...oldData, pages: newPages };
            });
        };

        const handleMessageUpdated = ({ chatId, message }: { chatId: string; message: Message }) => {
            if (chatId !== chatIdRef.current) return;
            
            queryClient.setQueryData(chatQueryKeys.messages(chatId), (oldData: any) => {
                if (!oldData) return oldData;
                const newPages = oldData.pages.map((page: Message[]) => 
                    page.map(m => m._id === message._id ? message : m)
                );
                return { ...oldData, pages: newPages };
            });
        };

        const handleMessageDeleted = ({ chatId, messageId }: { chatId: string; messageId: string }) => {
            if (chatId !== chatIdRef.current) return;
            
            queryClient.setQueryData(chatQueryKeys.messages(chatId), (oldData: any) => {
                if (!oldData) return oldData;
                const newPages = oldData.pages.map((page: Message[]) => 
                    page.map(m => m._id === messageId ? { ...m, deleted: true } : m)
                );
                return { ...oldData, pages: newPages };
            });
        };

        const handleUserTyping = (data: TypingUser) => {
            if (data.chatId !== chatIdRef.current) return;
            setTypingUsers((prev) => {
                const filtered = prev.filter(u => u.userId !== data.userId);
                return data.isTyping ? [...filtered, data] : filtered;
            });
        };

        const handlePresenceUpdate = (payload: { userId: string; status: 'online' | 'offline' }) => {
            setUserPresence(payload.userId, payload.status);
        };

        const handlePresencesInfo = (data: Record<string, 'online' | 'offline'>) => {
            setUsersPresence(data);
        };

        const connectionUnsub = chatSocketUseCase.onConnectionChange(setConnected);
        
        const unsubs = [
            connectionUnsub,
            chatSocketUseCase.on(SOCKET_EVENTS.NEW_MESSAGE, handleNewMessage),
            chatSocketUseCase.on(SOCKET_EVENTS.MESSAGE_EDITED, handleMessageUpdated),
            chatSocketUseCase.on(SOCKET_EVENTS.REACTION_UPDATED, handleMessageUpdated), // Re-use update handler
            chatSocketUseCase.on(SOCKET_EVENTS.MESSAGE_DELETED, handleMessageDeleted),
            chatSocketUseCase.on(SOCKET_EVENTS.USER_TYPING, handleUserTyping),
            chatSocketUseCase.on(SOCKET_EVENTS.USER_PRESENCE_UPDATE, handlePresenceUpdate),
            chatSocketUseCase.on(SOCKET_EVENTS.USERS_PRESENCE_INFO, handlePresencesInfo),
        ];

        chatSocketUseCase.connect().catch(console.error);

        return () => {
            unsubs.forEach(u => u());
        };
    }, [queryClient, setConnected, setTypingUsers, setUserPresence, setUsersPresence]);

    // Return the useCase for imperative actions (emitters)
    return getChatUseCases().chatSocketUseCase;
};

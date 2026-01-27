import { useCallback, useRef, useMemo } from 'react';
import { useChatStore } from '@/modules/chat/presentation/stores';
import { useTeamStore } from '@/modules/team/presentation/stores';
import { useChats, useChatMessages, useTeamMembers } from './use-chat-queries';
import { useChatSocket } from './use-chat-socket';
import { useChatSelection } from './use-chat-selection';

const TYPING_TIMEOUT_MS = 1000;

export const useChat = () => {
    const store = useChatStore((store) => store);
    const { selectedTeam } = useTeamStore();
    const selectedTeamId = selectedTeam?._id || null;

    const typingTimeoutRef = useRef<number | null>(null);

    // React Query Hooks
    const { data: chats = [], isLoading: isLoadingChats } = useChats();
    const { data: messagesData, isLoading: isLoadingMessages } = useChatMessages(store.currentChat?._id || null);
    
    // Flatten messages from infinite query pages
    const messages = useMemo(() => {
        return messagesData?.pages.flatMap(page => page) || [];
    }, [messagesData]);

    const { data: teamMembers = [] } = useTeamMembers(selectedTeamId);

    // Socket Hook
    const chatSocketUseCase = useChatSocket(store.currentChat?._id || null);

    // Selection Hook
    const { selectChat, startChatWithMember } = useChatSelection(selectedTeamId);

    const handleSendMessage = useCallback(async (content: string) => {
        if (!content.trim() || !store.currentChat?._id) return;
        try {
            await store.sendMessage(content);
        } catch (error: any) {
            console.error('[Chat] Failed to send message:', error);
        }
    }, [store.currentChat?._id, store]);

    const handleTyping = useCallback((chatId: string) => {
        chatSocketUseCase.startTyping(chatId);
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
            chatSocketUseCase.stopTyping(chatId);
        }, TYPING_TIMEOUT_MS);
    }, [chatSocketUseCase]);

    // Backward compatibility with store interface
    // but now driven by React Query
    return useMemo(() => ({
        ...store,
        // Overwrite store values with React Query values
        chats,
        messages,
        teamMembers,
        isLoadingChats,
        isLoadingMessages,
        
        // Methods
        selectChat,
        startChatWithMember,
        handleSendMessage,
        handleTyping
    }), [
        store, 
        chats, 
        messages, 
        teamMembers, 
        isLoadingChats, 
        isLoadingMessages,
        selectChat, 
        startChatWithMember, 
        handleSendMessage, 
        handleTyping
    ]);
};
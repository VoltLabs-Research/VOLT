import { useCallback, useRef } from 'react';
import { useChatStore } from '../stores';
import { chatRepository } from '../../infrastructure/repositories/ChatRepository';
import type { Chat } from '../../domain/entities';

export const useChatSelection = (selectedTeamId: string | null) => {
    const currentChat = useChatStore(s => s.currentChat);
    const setCurrentChat = useChatStore(s => s.setCurrentChat);
    const joinChat = useChatStore(s => s.joinChat);
    const leaveChat = useChatStore(s => s.leaveChat);
    const markAsRead = useChatStore(s => s.markAsRead);

    const selectingChatRef = useRef(false);

    const selectChat = useCallback(async (chat: Chat) => {
        if (selectingChatRef.current || currentChat?._id === chat._id) return;

        selectingChatRef.current = true;
        
        try {
            console.log('[Chat] Selecting chat:', chat._id);

            if (currentChat?._id) {
                leaveChat(currentChat._id);
            }

            setCurrentChat(chat);
            
            // We don't need to load messages manually anymore, React Query will handle it
            // when the chatId changes in the UI component.
            
            joinChat(chat._id);
            markAsRead(chat._id);

        } catch (error) {
            console.error('[Chat] Failed to select chat:', error);
        } finally {
            selectingChatRef.current = false;
        }
    }, [currentChat?._id, leaveChat, setCurrentChat, joinChat, markAsRead]);

    const startChatWithMember = useCallback(async (member: any) => {
        if (!selectedTeamId) return;

        try {
            const chat = await chatRepository.getOrCreateChat(selectedTeamId, member._id);
            await selectChat(chat);
        } catch (error: any) {
            console.error('[Chat] Failed to start chat with member:', error);
        }
    }, [selectedTeamId, selectChat]);

    return {
        selectChat,
        startChatWithMember
    };
};

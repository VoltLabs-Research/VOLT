import { useEffect, useCallback, useRef, useMemo } from 'react';
import { useChatStore } from '@/stores/slices/chat';
import { useTeamStore } from '@/features/team/stores';
import ChatSocketManager from '@/services/websockets/chat-socket-manager';

const TYPING_TIMEOUT_MS = 1000;

// Track which team's chat has been loaded
let chatLoadedForTeam: string | null = null;

export const useChat = () => {
    const store = useChatStore((store) => store);
    const { selectedTeam } = useTeamStore();

    const typingTimeoutRef = useRef<number | null>(null);
    const selectingChatRef = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const currentChatIdRef = useRef<string | null>(null);

    const selectedTeamId = selectedTeam?._id;

    // Sync current chat ID to ref
    useEffect(() => {
        currentChatIdRef.current = store.currentChat?._id || null;

        if (store.currentChat) {
            const participantIds = store.currentChat.participants.map(p => p._id);
            if (participantIds.length) {
                store.fetchUsersPresence(participantIds);
            }
        }
    }, [store.currentChat]);

    // Load chats and team members
    useEffect(() => {
        if (!selectedTeamId) return;
        // Skip if already loaded for this team
        if (chatLoadedForTeam === selectedTeamId) return;

        console.log('[Chat] Loading chats for team:', selectedTeamId);
        chatLoadedForTeam = selectedTeamId;

        const load = async () => {
            await store.loadChats();
            await store.loadTeamMembers(selectedTeamId);

            // Fetch initial presence for all team members
            const members = useChatStore.getState().teamMembers;
            if (members.length) {
                store.fetchUsersPresence(members.map(m => m._id));
            }
        };
        load();
    }, [selectedTeamId]); // Removed store functions from deps - they don't change

    // Register socket manager(singleton)
    useEffect(() => {
        const manager = ChatSocketManager.getInstance();
        manager.register(currentChatIdRef);

        return () => manager.unregister();
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            console.log('[Chat] Component unmounting, cleaning up resources');

            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            if (currentChatIdRef.current) {
                store.leaveChat(currentChatIdRef.current);
            }
        };
    }, [store.leaveChat]);

    const selectChat = useCallback(async (chat: any) => {
        if (selectingChatRef.current || store.currentChat?._id == chat._id) return;

        selectingChatRef.current = true;
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        try {
            console.log('[Chat] Selecting chat:', chat._id);

            if (store.currentChat?._id) {
                store.leaveChat(store.currentChat._id);
            }

            store.setCurrentChat(chat);
            await store.loadMessages(chat._id);

            if (!abortController.signal.aborted) {
                store.joinChat(chat._id);
                store.markAsRead(chat._id);
            }
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error('[Chat] Failed to select chat:', error);
            }
        } finally {
            selectingChatRef.current = false;
            if (abortControllerRef.current === abortController) {
                abortControllerRef.current = null;
            }
        }
    }, [store.currentChat?._id]);

    const startChatWithMember = useCallback(async (member: any) => {
        if (!selectedTeamId) return;

        try {
            const chat = await store.getOrCreateChat(selectedTeamId, member._id);
            await selectChat(chat);
        } catch (error: any) {
            console.error('[Chat] Failed to start chat with member:', error);
        }
    }, [selectedTeamId, store, selectChat]);

    const handleSendMessage = useCallback(async (content: string) => {
        if (!content.trim() || !store.currentChat?._id) return;

        try {
            await store.sendMessage(content);
        } catch (error: any) {
            console.error('[Chat] Failed to send message:', error);
        }
    }, [store.currentChat?._id, store]);

    const handleTyping = useCallback((chatId: string) => {
        store.startTyping(chatId);
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
            store.stopTyping(chatId);
        }, TYPING_TIMEOUT_MS);
    }, [store]);

    return useMemo(() => ({
        ...store,
        selectChat,
        startChatWithMember,
        handleSendMessage,
        handleTyping
    }), [store, selectChat, startChatWithMember, handleSendMessage, handleTyping]);
};

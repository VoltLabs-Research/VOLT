/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import { useEffect, useCallback, useRef } from 'react';
import { useChatStore } from '@/stores/chat';
import { socketService } from '@/services/socketio';
import useAuthStore from '@/stores/authentication';
import useTeamStore from '@/stores/team/team';
import { TokenStorage } from '@/utilities/storage';
import type { TypingUser, MessagesRead } from '@/types/chat';

// Flag to ensure socket listeners are only registered once globally
let socketListenersRegistered = false;

export const useChat = () => {
    const {
        chats,
        currentChat,
        messages,
        teamMembers,
        typingUsers,
        isLoading,
        isLoadingMessages,
        isLoadingChats,
        isConnected,
        setCurrentChat,
        getUserPresence,
        loadChats,
        loadTeamMembers,
        loadMessages,
        sendMessage,
        sendFileMessage,
        editMessage: editMessageStore,
        deleteMessage: deleteMessageStore,
        toggleReaction: toggleReactionStore,
        createGroupChat,
        addUsersToGroup,
        removeUsersFromGroup,
        updateGroupInfo,
        updateGroupAdmins,
        leaveGroup,
        markAsRead,
        getOrCreateChat,
        joinChat,
        leaveChat,
        startTyping,
        stopTyping
    } = useChatStore();

    const { user } = useAuthStore();
    const { selectedTeam } = useTeamStore();
    const typingTimeoutRef = useRef<number | null>(null);
    const selectingChatRef = useRef(false);

    // Initialize socket connection and authentication
    useEffect(() => {
        if (user) {
            // Get token from TokenStorage and update socket auth only if needed
            const token = TokenStorage.getToken();
            if (token) {
                // Only update auth if socket is not connected or token is different
                if (!socketService.isConnected() || socketService.getCurrentToken() !== token) {
                    console.log('[Chat] Updating socket authentication');
                    socketService.updateAuth({ token });
                }
            }
        }
    }, [user]);

    // Load chats when component mounts or team changes
    useEffect(() => {
        if (selectedTeam) {
            loadChats();
            loadTeamMembers(selectedTeam._id);
        }
    }, [selectedTeam, loadChats, loadTeamMembers]);

    // Socket event listeners
    useEffect(() => {
        // Skip if listeners are already registered
        if (socketListenersRegistered) {
            console.log('[Chat] Socket listeners already registered, skipping');
            return;
        }

        console.log('[Chat] Registering socket listeners');
        socketListenersRegistered = true;

        const handleConnect = (connected: boolean) => {
            const { setConnected } = useChatStore.getState();
            setConnected(connected);
            if (connected) {
                console.log('[Chat] Socket connected');
            } else {
                console.log('[Chat] Socket disconnected');
            }
        };

        const handleJoinedChat = (data: { chatId: string }) => {
            console.log('Joined chat:', data.chatId);
        };

        const handleLeftChat = (data: { chatId: string }) => {
            console.log('Left chat:', data.chatId);
        };

        const handleNewMessage = (data: { message: any; chatId: string }) => {
            console.log('[Chat] New message received:', data);
            // Only add message if it's for the current chat
            const { currentChat, addMessage } = useChatStore.getState();
            if (currentChat && currentChat._id === data.chatId) {
                addMessage(data.message);
            }
        };

        const handleUserTyping = (data: TypingUser) => {
            const { typingUsers, setTypingUsers } = useChatStore.getState();
            const filtered = typingUsers.filter((u: TypingUser) => u.userId !== data.userId);
            if (data.isTyping) {
                setTypingUsers([...filtered, data]);
            } else {
                setTypingUsers(filtered);
            }
        };

        const handleMessagesRead = (data: MessagesRead) => {
            const { messages, setMessages } = useChatStore.getState();
            // Update message read status
            setMessages(messages.map(msg => ({
                ...msg,
                readBy: msg.readBy.map(user => user._id === data.readBy ? user : user)
            })));
        };

        const handleError = (error: string) => {
            console.error('Chat socket error:', error);
        };

        const handleMessageEdited = (payload: { chatId: string; message: any }) => {
            const { currentChat, messages, setMessages } = useChatStore.getState();
            if (currentChat && currentChat._id === payload.chatId) {
                const updated = payload.message;
                setMessages(messages.map(m => m._id === updated._id ? updated : m));
            }
        };

        const handleMessageDeleted = (payload: { chatId: string; messageId: string }) => {
            const { currentChat, messages, setMessages } = useChatStore.getState();
            if (currentChat && currentChat._id === payload.chatId) {
                setMessages(messages.map(m => m._id === payload.messageId ? { ...m, deleted: true } as any : m));
            }
        };

        const handleReactionUpdated = (payload: { chatId: string; message: any }) => {
            const { currentChat, messages, setMessages } = useChatStore.getState();
            if (currentChat && currentChat._id === payload.chatId && payload.message) {
                const updated = payload.message;
                
                // Deduplicate reactions to prevent duplicate emojis
                if (updated.reactions && Array.isArray(updated.reactions)) {
                    const seen = new Set();
                    updated.reactions = updated.reactions.filter((reaction: any) => {
                        if (seen.has(reaction.emoji)) {
                            return false;
                        }
                        seen.add(reaction.emoji);
                        return true;
                    });
                }
                
                setMessages(messages.map(m => m._id === updated._id ? updated : m));
            }
        };

        const handleUserPresenceUpdate = (payload: { userId: string; status: 'online' | 'offline'; timestamp: string }) => {
            const { setUserPresence } = useChatStore.getState();
            setUserPresence(payload.userId, payload.status);
        };

        // Register event listeners
        socketService.onConnectionChange(handleConnect);
        socketService.on('joined_chat', handleJoinedChat);
        socketService.on('left_chat', handleLeftChat);
        socketService.on('new_message', handleNewMessage);
        socketService.on('user_typing', handleUserTyping);
        socketService.on('messages_read', handleMessagesRead);
        socketService.on('error', handleError);
        socketService.on('message_edited', handleMessageEdited);
        socketService.on('message_deleted', handleMessageDeleted);
        socketService.on('reaction_updated', handleReactionUpdated);
        socketService.on('user_presence_update', handleUserPresenceUpdate);

        // Initialize connection if not connected
        if (!socketService.isConnected()) {
            socketService.connect()
                .catch((error) => {
                    console.error('Failed to connect socket:', error);
                });
        } else {
            const { setConnected } = useChatStore.getState();
            setConnected(true);
        }

        // Don't return cleanup here - listeners should persist across all component instances
    }, []); // ✅ Empty dependencies - only run once on mount

    // Select a chat and load its messages
    const selectChat = useCallback(async (chat: any) => {
        // Prevent duplicate selections
        if (selectingChatRef.current) return;
        if (currentChat?._id === chat._id) return;

        selectingChatRef.current = true;

        try {
            // Leave current chat if any
            if (currentChat) {
                leaveChat(currentChat._id);
            }

            setCurrentChat(chat);
            await loadMessages(chat._id);
            joinChat(chat._id);
            markAsRead(chat._id);
        } finally {
            selectingChatRef.current = false;
        }
    }, [currentChat, setCurrentChat, loadMessages, joinChat, leaveChat, markAsRead]);

    // Create or get a chat with a team member
    const startChatWithMember = useCallback(async (member: any) => {
        if (!selectedTeam) return;

        try {
            const chat = await getOrCreateChat(selectedTeam._id, member._id);
            await selectChat(chat);
        } catch (error) {
            console.error('Failed to start chat with member:', error);
        }
    }, [selectedTeam, getOrCreateChat, selectChat]);

    // Send a message
    const handleSendMessage = useCallback(async (content: string) => {
        if (!content.trim() || !currentChat) return;

        await sendMessage(content);
    }, [currentChat, sendMessage]);

    // Handle typing indicators
    const handleTyping = useCallback((chatId: string) => {
        startTyping(chatId);

        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Set timeout to stop typing
        typingTimeoutRef.current = setTimeout(() => {
            stopTyping(chatId);
        }, 1000);
    }, [startTyping, stopTyping]);

    // Cleanup typing timeout on unmount
    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, []);

    return {
        // State
        chats,
        currentChat,
        messages,
        teamMembers,
        typingUsers,
        isLoading,
        isLoadingMessages,
        isLoadingChats,
        isConnected,

        // Actions
        selectChat,
        startChatWithMember,
        handleSendMessage,
        sendFileMessage,
        handleTyping,
        loadChats,
        editMessage: editMessageStore,
        deleteMessage: deleteMessageStore,
        toggleReaction: toggleReactionStore,
        createGroupChat,
        addUsersToGroup,
        removeUsersFromGroup,
        updateGroupInfo,
        updateGroupAdmins,
        leaveGroup,
        getUserPresence
    };
};